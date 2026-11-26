import { createRoute } from "@hono/zod-openapi";
import {
  AccountCreateRequestSchema,
  AccountResponseSchema,
  AccountsListQuerySchema,
  AccountsListResponseSchema,
  AccountUpdateRequestSchema,
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  type Account,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

function serializeAccountRow(row: AccountRow): Account {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type as Account["type"],
    currency: row.currency,
    initial_balance_minor: row.initial_balance_minor,
    credit_limit_minor: row.credit_limit_minor,
    bank_name: row.bank_name,
    last4_digits: row.last4_digits,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const listAccountsRoute = createRoute({
  method: "get",
  path: "/accounts",
  tags: ["Accounts"],
  summary: "List user's non-deleted financial accounts",
  security: AUTH_SECURITY,
  request: {
    query: AccountsListQuerySchema,
  },
  responses: {
    200: {
      description: "List of accounts ordered by sort_order",
      content: { "application/json": { schema: AccountsListResponseSchema } },
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
      description: "Failed to load accounts",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createAccountRoute = createRoute({
  method: "post",
  path: "/accounts",
  tags: ["Accounts"],
  summary: "Create a new financial account",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: AccountCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Account created",
      content: { "application/json": { schema: AccountResponseSchema } },
    },
    400: {
      description: "Validation error",
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
      description: "Failed to create account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateAccountRoute = createRoute({
  method: "patch",
  path: "/accounts/{id}",
  tags: ["Accounts"],
  summary: "Update an existing account",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: AccountUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Account updated",
      content: { "application/json": { schema: AccountResponseSchema } },
    },
    400: {
      description: "Validation error",
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
      description: "Account not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteAccountRoute = createRoute({
  method: "delete",
  path: "/accounts/{id}",
  tags: ["Accounts"],
  summary: "Soft-delete an account (preserves sync tombstone & historical transactions)",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Account soft-deleted",
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
      description: "Account not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createAccountsRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/accounts", requireAuth, requireInviteGate);
  router.use("/accounts/*", requireAuth, requireInviteGate);

  router.openapi(listAccountsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { active_only } = c.req.valid("query");
    let query = auth.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (active_only === "true") {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      return c.json({ error: "ACCOUNTS_LOAD_FAILED", message: error.message }, 500);
    }

    return c.json({ accounts: (data ?? []).map(serializeAccountRow) }, 200);
  });

  router.openapi(createAccountRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    let sortOrder = body.sort_order;
    if (sortOrder === undefined) {
      const { data: existing } = await auth.supabase
        .from("accounts")
        .select("sort_order")
        .eq("user_id", auth.userId)
        .is("deleted_at", null);

      const maxOrder = (existing ?? []).reduce(
        (max, row) => Math.max(max, row.sort_order ?? 0),
        -1
      );
      sortOrder = maxOrder + 1;
    }

    const insertRow: Database["public"]["Tables"]["accounts"]["Insert"] = {
      user_id: auth.userId,
      name: body.name,
      type: body.type,
      currency: body.currency,
      initial_balance_minor: body.initial_balance_minor,
      credit_limit_minor: body.credit_limit_minor,
      bank_name: body.bank_name ? body.bank_name : null,
      last4_digits: body.last4_digits ? body.last4_digits : null,
      is_active: body.is_active,
      sort_order: sortOrder,
    };

    const { data, error } = await auth.supabase
      .from("accounts")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "ACCOUNT_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ account: serializeAccountRow(data) }, 201);
  });

  router.openapi(updateAccountRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const patch: Database["public"]["Tables"]["accounts"]["Update"] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.type !== undefined) patch.type = body.type;
    if (body.currency !== undefined) patch.currency = body.currency;
    if (body.initial_balance_minor !== undefined) {
      patch.initial_balance_minor = body.initial_balance_minor;
    }
    if (body.credit_limit_minor !== undefined) {
      patch.credit_limit_minor = body.credit_limit_minor;
    }
    if (body.bank_name !== undefined) patch.bank_name = body.bank_name ? body.bank_name : null;
    if (body.last4_digits !== undefined) {
      patch.last4_digits = body.last4_digits ? body.last4_digits : null;
    }
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

    const { data, error } = await auth.supabase
      .from("accounts")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "ACCOUNT_UPDATE_FAILED", message: error.message }, 500);
    }

    if (!data) {
      return c.json({ error: "ACCOUNT_NOT_FOUND", message: "Account not found" }, 404);
    }

    return c.json({ account: serializeAccountRow(data) }, 200);
  });

  router.openapi(deleteAccountRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("accounts")
      .update({ deleted_at: deletedAt, is_active: false })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "ACCOUNT_DELETE_FAILED", message: error.message }, 500);
    }

    if (!data || !data.deleted_at) {
      return c.json({ error: "ACCOUNT_NOT_FOUND", message: "Account not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
