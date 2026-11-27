import { createRoute } from "@hono/zod-openapi";
import {
  DebtCreateRequestSchema,
  DebtResponseSchema,
  DebtsListQuerySchema,
  DebtsListResponseSchema,
  DebtUpdateRequestSchema,
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  type Debt,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type DebtRow = Database["public"]["Tables"]["debts"]["Row"];

function serializeDebtRow(row: DebtRow): Debt {
  return {
    id: row.id,
    user_id: row.user_id,
    direction: row.direction as Debt["direction"],
    counterparty: row.counterparty,
    amount_minor: row.amount_minor,
    manual_repaid_minor: row.manual_repaid_minor,
    opened_at: row.opened_at,
    due_date: row.due_date,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const listDebtsRoute = createRoute({
  method: "get",
  path: "/debts",
  tags: ["Debts"],
  summary: "List user's non-deleted debts in FIFO order",
  security: AUTH_SECURITY,
  request: {
    query: DebtsListQuerySchema,
  },
  responses: {
    200: {
      description: "List of debts",
      content: { "application/json": { schema: DebtsListResponseSchema } },
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
      description: "Failed to load debts",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createDebtRoute = createRoute({
  method: "post",
  path: "/debts",
  tags: ["Debts"],
  summary: "Create a 2-way debt entry (lent or borrowed)",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: DebtCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Debt created",
      content: { "application/json": { schema: DebtResponseSchema } },
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
      description: "Failed to create debt",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateDebtRoute = createRoute({
  method: "patch",
  path: "/debts/{id}",
  tags: ["Debts"],
  summary: "Update a debt or adjust manual repayment",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: DebtUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Debt updated",
      content: { "application/json": { schema: DebtResponseSchema } },
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
      description: "Debt not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update debt",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteDebtRoute = createRoute({
  method: "delete",
  path: "/debts/{id}",
  tags: ["Debts"],
  summary: "Soft-delete a debt",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Debt soft-deleted",
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
      description: "Debt not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete debt",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createDebtsRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/debts", requireAuth, requireInviteGate);
  router.use("/debts/*", requireAuth, requireInviteGate);

  router.openapi(listDebtsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { direction } = c.req.valid("query");
    let query = auth.supabase
      .from("debts")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (direction) {
      query = query.eq("direction", direction);
    }

    const { data, error } = await query;
    if (error) {
      return c.json({ error: "DEBTS_LOAD_FAILED", message: error.message }, 500);
    }

    return c.json({ debts: (data ?? []).map(serializeDebtRow) }, 200);
  });

  router.openapi(createDebtRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const insertRow: Database["public"]["Tables"]["debts"]["Insert"] = {
      user_id: auth.userId,
      direction: body.direction,
      counterparty: body.counterparty,
      amount_minor: body.amount_minor,
      manual_repaid_minor: body.manual_repaid_minor,
      opened_at: body.opened_at,
      due_date: body.due_date,
      comment: body.comment,
    };

    const { data, error } = await auth.supabase
      .from("debts")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "DEBT_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ debt: serializeDebtRow(data) }, 201);
  });

  router.openapi(updateDebtRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const { data: existing, error: fetchErr } = await auth.supabase
      .from("debts")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr) {
      return c.json({ error: "DEBTS_LOAD_FAILED", message: fetchErr.message }, 500);
    }
    if (!existing) {
      return c.json({ error: "DEBT_NOT_FOUND", message: "Debt not found" }, 404);
    }

    const nextAmount = body.amount_minor ?? existing.amount_minor;
    const nextManualRepaid = body.manual_repaid_minor ?? existing.manual_repaid_minor;

    if (nextManualRepaid > nextAmount) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "manual_repaid_minor cannot exceed amount_minor",
        },
        400
      );
    }

    const patch: Database["public"]["Tables"]["debts"]["Update"] = {};
    if (body.direction !== undefined) patch.direction = body.direction;
    if (body.counterparty !== undefined) patch.counterparty = body.counterparty;
    if (body.amount_minor !== undefined) patch.amount_minor = body.amount_minor;
    if (body.manual_repaid_minor !== undefined) patch.manual_repaid_minor = body.manual_repaid_minor;
    if (body.opened_at !== undefined) patch.opened_at = body.opened_at;
    if (body.due_date !== undefined) patch.due_date = body.due_date;
    if (body.comment !== undefined) patch.comment = body.comment;

    const { data, error } = await auth.supabase
      .from("debts")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "DEBT_UPDATE_FAILED", message: error.message }, 500);
    }
    if (!data) {
      return c.json({ error: "DEBT_NOT_FOUND", message: "Debt not found" }, 404);
    }

    return c.json({ debt: serializeDebtRow(data) }, 200);
  });

  router.openapi(deleteDebtRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("debts")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "DEBT_DELETE_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json({ error: "DEBT_NOT_FOUND", message: "Debt not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
