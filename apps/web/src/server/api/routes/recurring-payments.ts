import { createRoute } from "@hono/zod-openapi";
import {
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  RecurringPaymentCreateRequestSchema,
  RecurringPaymentMarkParamsSchema,
  RecurringPaymentMarkRequestSchema,
  RecurringPaymentMarkResponseSchema,
  RecurringPaymentResponseSchema,
  RecurringPaymentsListQuerySchema,
  RecurringPaymentsListResponseSchema,
  RecurringPaymentUpdateRequestSchema,
  type RecurringPayment,
  type RecurringPaymentMark,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type RecurringPaymentRow = Database["public"]["Tables"]["recurring_payments"]["Row"];
type RecurringPaymentMarkRow = Database["public"]["Tables"]["recurring_payment_marks"]["Row"];

function serializeRecurringPaymentRow(row: RecurringPaymentRow): RecurringPayment {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    category_id: row.category_id,
    account_id: row.account_id,
    amount_minor: row.amount_minor,
    day_of_month: row.day_of_month,
    cadence: row.cadence as RecurringPayment["cadence"],
    match_keyword: row.match_keyword,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function serializeMarkRow(row: RecurringPaymentMarkRow): RecurringPaymentMark {
  return {
    id: row.id,
    user_id: row.user_id,
    recurring_payment_id: row.recurring_payment_id,
    period_key: row.period_key,
    marked_at: row.marked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

async function verifyRecurringReferences(
  supabase: AppSupabaseClient,
  userId: string,
  refs: { account_id?: string | null; category_id?: string | null }
): Promise<{ ok: true } | { ok: false; field: string }> {
  if (refs.account_id) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", refs.account_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, field: "account_id" };
    }
  }
  if (refs.category_id) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("id", refs.category_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, field: "category_id" };
    }
  }
  return { ok: true };
}

const listRecurringPaymentsRoute = createRoute({
  method: "get",
  path: "/recurring-payments",
  tags: ["Recurring Payments"],
  summary: "List user's recurring payments and period marks",
  security: AUTH_SECURITY,
  request: {
    query: RecurringPaymentsListQuerySchema,
  },
  responses: {
    200: {
      description: "List of recurring payments and payment marks",
      content: { "application/json": { schema: RecurringPaymentsListResponseSchema } },
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
      description: "Failed to load recurring payments",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createRecurringPaymentRoute = createRoute({
  method: "post",
  path: "/recurring-payments",
  tags: ["Recurring Payments"],
  summary: "Create a recurring payment template",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RecurringPaymentCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Recurring payment created",
      content: { "application/json": { schema: RecurringPaymentResponseSchema } },
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
    500: {
      description: "Failed to create recurring payment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateRecurringPaymentRoute = createRoute({
  method: "patch",
  path: "/recurring-payments/{id}",
  tags: ["Recurring Payments"],
  summary: "Update a recurring payment",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: RecurringPaymentUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Recurring payment updated",
      content: { "application/json": { schema: RecurringPaymentResponseSchema } },
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
      description: "Recurring payment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update recurring payment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteRecurringPaymentRoute = createRoute({
  method: "delete",
  path: "/recurring-payments/{id}",
  tags: ["Recurring Payments"],
  summary: "Soft-delete a recurring payment",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Recurring payment soft-deleted",
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
      description: "Recurring payment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete recurring payment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const markRecurringPaymentRoute = createRoute({
  method: "post",
  path: "/recurring-payments/{id}/marks",
  tags: ["Recurring Payments"],
  summary: "Mark a recurring payment as paid for a given YYYY-MM period (idempotent)",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: RecurringPaymentMarkRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Period already marked",
      content: { "application/json": { schema: RecurringPaymentMarkResponseSchema } },
    },
    201: {
      description: "Period marked as paid",
      content: { "application/json": { schema: RecurringPaymentMarkResponseSchema } },
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
      description: "Recurring payment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to mark recurring payment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const unmarkRecurringPaymentRoute = createRoute({
  method: "delete",
  path: "/recurring-payments/{id}/marks/{periodKey}",
  tags: ["Recurring Payments"],
  summary: "Remove a manual paid mark for a recurring payment and period",
  security: AUTH_SECURITY,
  request: {
    params: RecurringPaymentMarkParamsSchema,
  },
  responses: {
    200: {
      description: "Mark soft-deleted",
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
      description: "Mark not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to remove mark",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createRecurringPaymentsRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/recurring-payments", requireAuth, requireInviteGate);
  router.use("/recurring-payments/*", requireAuth, requireInviteGate);

  router.openapi(listRecurringPaymentsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { active_only, period } = c.req.valid("query");

    let paymentsQuery = auth.supabase
      .from("recurring_payments")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("day_of_month", { ascending: true })
      .order("created_at", { ascending: true });

    if (active_only === "true") {
      paymentsQuery = paymentsQuery.eq("is_active", true);
    }

    let marksQuery = auth.supabase
      .from("recurring_payment_marks")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("marked_at", { ascending: false });

    if (period) {
      marksQuery = marksQuery.eq("period_key", period);
    }

    const [paymentsRes, marksRes] = await Promise.all([paymentsQuery, marksQuery]);
    if (paymentsRes.error) {
      return c.json(
        { error: "RECURRING_PAYMENTS_LOAD_FAILED", message: paymentsRes.error.message },
        500
      );
    }
    if (marksRes.error) {
      return c.json(
        { error: "RECURRING_PAYMENTS_LOAD_FAILED", message: marksRes.error.message },
        500
      );
    }

    return c.json(
      {
        recurring_payments: (paymentsRes.data ?? []).map(serializeRecurringPaymentRow),
        marks: (marksRes.data ?? []).map(serializeMarkRow),
      },
      200
    );
  });

  router.openapi(createRecurringPaymentRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const refCheck = await verifyRecurringReferences(auth.supabase, auth.userId, body);
    if (!refCheck.ok) {
      return c.json(
        { error: "INVALID_REFERENCE", message: `Referenced ${refCheck.field} was not found` },
        400
      );
    }

    const cleanKeyword = body.match_keyword?.trim();
    const insertRow: Database["public"]["Tables"]["recurring_payments"]["Insert"] = {
      user_id: auth.userId,
      name: body.name,
      category_id: body.category_id,
      account_id: body.account_id,
      amount_minor: body.amount_minor,
      day_of_month: body.day_of_month,
      cadence: body.cadence,
      match_keyword: cleanKeyword && cleanKeyword.length > 0 ? cleanKeyword : null,
      is_active: body.is_active,
    };

    const { data, error } = await auth.supabase
      .from("recurring_payments")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "RECURRING_PAYMENT_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ recurring_payment: serializeRecurringPaymentRow(data) }, 201);
  });

  router.openapi(updateRecurringPaymentRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const refCheck = await verifyRecurringReferences(auth.supabase, auth.userId, body);
    if (!refCheck.ok) {
      return c.json(
        { error: "INVALID_REFERENCE", message: `Referenced ${refCheck.field} was not found` },
        400
      );
    }

    const patch: Database["public"]["Tables"]["recurring_payments"]["Update"] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.category_id !== undefined) patch.category_id = body.category_id;
    if (body.account_id !== undefined) patch.account_id = body.account_id;
    if (body.amount_minor !== undefined) patch.amount_minor = body.amount_minor;
    if (body.day_of_month !== undefined) patch.day_of_month = body.day_of_month;
    if (body.cadence !== undefined) patch.cadence = body.cadence;
    if (body.match_keyword !== undefined) {
      const cleanKeyword = body.match_keyword?.trim();
      patch.match_keyword = cleanKeyword && cleanKeyword.length > 0 ? cleanKeyword : null;
    }
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const { data, error } = await auth.supabase
      .from("recurring_payments")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "RECURRING_PAYMENT_UPDATE_FAILED", message: error.message }, 500);
    }
    if (!data) {
      return c.json(
        { error: "RECURRING_PAYMENT_NOT_FOUND", message: "Recurring payment not found" },
        404
      );
    }

    return c.json({ recurring_payment: serializeRecurringPaymentRow(data) }, 200);
  });

  router.openapi(deleteRecurringPaymentRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("recurring_payments")
      .update({ deleted_at: deletedAt, is_active: false })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "RECURRING_PAYMENT_DELETE_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json(
        { error: "RECURRING_PAYMENT_NOT_FOUND", message: "Recurring payment not found" },
        404
      );
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  router.openapi(markRecurringPaymentRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const { period_key } = c.req.valid("json");

    const { data: payment, error: payErr } = await auth.supabase
      .from("recurring_payments")
      .select("id")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (payErr) {
      return c.json({ error: "RECURRING_MARK_FAILED", message: payErr.message }, 500);
    }
    if (!payment) {
      return c.json(
        { error: "RECURRING_PAYMENT_NOT_FOUND", message: "Recurring payment not found" },
        404
      );
    }

    const { data: existingMark, error: markCheckErr } = await auth.supabase
      .from("recurring_payment_marks")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("recurring_payment_id", id)
      .eq("period_key", period_key)
      .is("deleted_at", null)
      .maybeSingle();

    if (markCheckErr) {
      return c.json({ error: "RECURRING_MARK_FAILED", message: markCheckErr.message }, 500);
    }
    if (existingMark) {
      return c.json({ mark: serializeMarkRow(existingMark) }, 200);
    }

    const { data: created, error: insertErr } = await auth.supabase
      .from("recurring_payment_marks")
      .insert({
        user_id: auth.userId,
        recurring_payment_id: id,
        period_key,
        marked_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr || !created) {
      return c.json(
        { error: "RECURRING_MARK_FAILED", message: insertErr?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ mark: serializeMarkRow(created) }, 201);
  });

  router.openapi(unmarkRecurringPaymentRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id, periodKey } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("recurring_payment_marks")
      .update({ deleted_at: deletedAt })
      .eq("user_id", auth.userId)
      .eq("recurring_payment_id", id)
      .eq("period_key", periodKey)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "RECURRING_UNMARK_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json({ error: "MARK_NOT_FOUND", message: "Recurring payment mark not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
