import { createRoute } from "@hono/zod-openapi";
import {
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  TransactionCreateRequestSchema,
  TransactionResponseSchema,
  TransactionsListQuerySchema,
  TransactionsListResponseSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  TransactionUpdateRequestSchema,
  validateTransactionDomainRules,
  z,
  type Transaction,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function serializeTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    user_id: row.user_id,
    occurred_at: row.occurred_at,
    type: row.type as Transaction["type"],
    amount_minor: row.amount_minor,
    category_id: row.category_id,
    account_from_id: row.account_from_id,
    account_to_id: row.account_to_id,
    goal_id: row.goal_id,
    debt_id: row.debt_id,
    recurring_payment_id: row.recurring_payment_id,
    comment: row.comment,
    status: row.status as Transaction["status"],
    source: row.source as Transaction["source"],
    external_hash: row.external_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const MergedTransactionInvariantSchema = z
  .object({
    type: TransactionTypeSchema,
    status: TransactionStatusSchema,
    account_from_id: z.uuid().nullable(),
    account_to_id: z.uuid().nullable(),
  })
  .superRefine(validateTransactionDomainRules);

async function verifyReferenceExists(
  supabase: AppSupabaseClient,
  table: "accounts" | "categories" | "goals" | "debts" | "recurring_payments",
  id: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  return !error && Boolean(data);
}

async function verifyTransactionReferences(
  supabase: AppSupabaseClient,
  userId: string,
  refs: {
    account_from_id?: string | null;
    account_to_id?: string | null;
    category_id?: string | null;
    goal_id?: string | null;
    debt_id?: string | null;
    recurring_payment_id?: string | null;
  }
): Promise<{ ok: true } | { ok: false; field: string }> {
  const checks: Array<{
    field: string;
    table: "accounts" | "categories" | "goals" | "debts" | "recurring_payments";
    id: string | null | undefined;
  }> = [
    { field: "account_from_id", table: "accounts", id: refs.account_from_id },
    { field: "account_to_id", table: "accounts", id: refs.account_to_id },
    { field: "category_id", table: "categories", id: refs.category_id },
    { field: "goal_id", table: "goals", id: refs.goal_id },
    { field: "debt_id", table: "debts", id: refs.debt_id },
    { field: "recurring_payment_id", table: "recurring_payments", id: refs.recurring_payment_id },
  ];

  const activeChecks = checks.filter((item): item is typeof item & { id: string } =>
    Boolean(item.id)
  );
  if (activeChecks.length === 0) {
    return { ok: true };
  }

  const results = await Promise.all(
    activeChecks.map(async (item) => ({
      field: item.field,
      found: await verifyReferenceExists(supabase, item.table, item.id, userId),
    }))
  );

  const missing = results.find((r) => !r.found);
  return missing ? { ok: false, field: missing.field } : { ok: true };
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

const listTransactionsRoute = createRoute({
  method: "get",
  path: "/transactions",
  tags: ["Transactions"],
  summary: "List and filter transactions across all 11 types",
  security: AUTH_SECURITY,
  request: {
    query: TransactionsListQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated transactions list",
      content: { "application/json": { schema: TransactionsListResponseSchema } },
    },
    400: {
      description: "Invalid query parameters",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to load transactions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createTransactionRoute = createRoute({
  method: "post",
  path: "/transactions",
  tags: ["Transactions"],
  summary: "Create a transaction (any of the 11 domain types)",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: TransactionCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Transaction created",
      content: { "application/json": { schema: TransactionResponseSchema } },
    },
    400: {
      description: "Validation or reference error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Duplicate external_hash",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to create transaction",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateTransactionRoute = createRoute({
  method: "patch",
  path: "/transactions/{id}",
  tags: ["Transactions"],
  summary: "Update an existing transaction or confirm a draft",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: TransactionUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Transaction updated",
      content: { "application/json": { schema: TransactionResponseSchema } },
    },
    400: {
      description: "Validation or reference error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Transaction not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update transaction",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteTransactionRoute = createRoute({
  method: "delete",
  path: "/transactions/{id}",
  tags: ["Transactions"],
  summary: "Soft-delete a transaction",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Transaction soft-deleted",
      content: { "application/json": { schema: DeletedEntityResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Transaction not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete transaction",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createTransactionsRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/transactions", requireAuth, requireInviteGate);
  router.use("/transactions/*", requireAuth, requireInviteGate);

  router.openapi(listTransactionsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const query = c.req.valid("query");
    let dbQuery = auth.supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("user_id", auth.userId)
      .is("deleted_at", null);

    if (query.from) dbQuery = dbQuery.gte("occurred_at", query.from);
    if (query.to) dbQuery = dbQuery.lte("occurred_at", query.to);
    if (query.type) dbQuery = dbQuery.eq("type", query.type);
    if (query.status) dbQuery = dbQuery.eq("status", query.status);
    if (query.category_id) dbQuery = dbQuery.eq("category_id", query.category_id);
    if (query.account_id) {
      dbQuery = dbQuery.or(
        `account_from_id.eq.${query.account_id},account_to_id.eq.${query.account_id}`
      );
    }
    if (query.search && query.search.length > 0) {
      dbQuery = dbQuery.ilike("comment", `%${escapeIlikePattern(query.search)}%`);
    }

    const { data, error, count } = await dbQuery
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      return c.json({ error: "TRANSACTIONS_LOAD_FAILED", message: error.message }, 500);
    }

    const rows = (data ?? []).map(serializeTransactionRow);
    const total = count ?? rows.length;
    const hasMore = query.offset + rows.length < total;

    return c.json(
      {
        transactions: rows,
        total,
        has_more: hasMore,
      },
      200
    );
  });

  router.openapi(createTransactionRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const refCheck = await verifyTransactionReferences(auth.supabase, auth.userId, body);
    if (!refCheck.ok) {
      return c.json(
        {
          error: "INVALID_REFERENCE",
          message: `Referenced ${refCheck.field} was not found`,
        },
        400
      );
    }

    const insertRow: Database["public"]["Tables"]["transactions"]["Insert"] = {
      user_id: auth.userId,
      occurred_at: body.occurred_at,
      type: body.type,
      amount_minor: body.amount_minor,
      category_id: body.category_id,
      account_from_id: body.account_from_id,
      account_to_id: body.account_to_id,
      goal_id: body.goal_id,
      debt_id: body.debt_id,
      recurring_payment_id: body.recurring_payment_id,
      comment: body.comment,
      status: body.status,
      source: body.source,
      external_hash: body.external_hash,
    };

    const { data, error } = await auth.supabase
      .from("transactions")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return c.json(
          {
            error: "DUPLICATE_TRANSACTION",
            message: "A transaction with this external_hash already exists",
          },
          409
        );
      }
      return c.json({ error: "TRANSACTION_CREATE_FAILED", message: error.message }, 500);
    }

    if (!data) {
      return c.json(
        { error: "TRANSACTION_CREATE_FAILED", message: "Failed to insert transaction" },
        500
      );
    }

    return c.json({ transaction: serializeTransactionRow(data) }, 201);
  });

  router.openapi(updateTransactionRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const { data: existing, error: fetchError } = await auth.supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError) {
      return c.json({ error: "TRANSACTIONS_LOAD_FAILED", message: fetchError.message }, 500);
    }

    if (!existing) {
      return c.json({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found" }, 404);
    }

    const nextType = body.type ?? (existing.type as Transaction["type"]);
    const nextStatus = body.status ?? (existing.status as Transaction["status"]);
    const nextAccountFromId =
      body.account_from_id !== undefined ? body.account_from_id : existing.account_from_id;
    const nextAccountToId =
      body.account_to_id !== undefined
        ? body.account_to_id
        : body.type !== undefined && body.type !== "transfer"
          ? null
          : existing.account_to_id;

    const domainCheck = MergedTransactionInvariantSchema.safeParse({
      type: nextType,
      status: nextStatus,
      account_from_id: nextAccountFromId,
      account_to_id: nextAccountToId,
    });

    if (!domainCheck.success) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "Transaction invariant validation failed",
          details: domainCheck.error.issues,
        },
        400
      );
    }

    const refCheck = await verifyTransactionReferences(auth.supabase, auth.userId, {
      account_from_id: body.account_from_id,
      account_to_id: body.account_to_id,
      category_id: body.category_id,
      goal_id: body.goal_id,
      debt_id: body.debt_id,
      recurring_payment_id: body.recurring_payment_id,
    });

    if (!refCheck.ok) {
      return c.json(
        {
          error: "INVALID_REFERENCE",
          message: `Referenced ${refCheck.field} was not found`,
        },
        400
      );
    }

    const patch: Database["public"]["Tables"]["transactions"]["Update"] = {};
    if (body.occurred_at !== undefined) patch.occurred_at = body.occurred_at;
    if (body.type !== undefined) patch.type = body.type;
    if (body.amount_minor !== undefined) patch.amount_minor = body.amount_minor;
    if (body.category_id !== undefined) patch.category_id = body.category_id;
    if (body.account_from_id !== undefined) patch.account_from_id = body.account_from_id;
    if (body.account_to_id !== undefined || (body.type !== undefined && body.type !== "transfer")) {
      patch.account_to_id = nextAccountToId;
    }
    if (body.goal_id !== undefined) patch.goal_id = body.goal_id;
    if (body.debt_id !== undefined) patch.debt_id = body.debt_id;
    if (body.recurring_payment_id !== undefined) {
      patch.recurring_payment_id = body.recurring_payment_id;
    }
    if (body.comment !== undefined) patch.comment = body.comment;
    if (body.status !== undefined) patch.status = body.status;
    if (body.external_hash !== undefined) patch.external_hash = body.external_hash;

    const { data, error } = await auth.supabase
      .from("transactions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "TRANSACTION_UPDATE_FAILED", message: error.message }, 500);
    }

    if (!data) {
      return c.json({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found" }, 404);
    }

    return c.json({ transaction: serializeTransactionRow(data) }, 200);
  });

  router.openapi(deleteTransactionRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("transactions")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "TRANSACTION_DELETE_FAILED", message: error.message }, 500);
    }

    if (!data || !data.deleted_at) {
      return c.json({ error: "TRANSACTION_NOT_FOUND", message: "Transaction not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
