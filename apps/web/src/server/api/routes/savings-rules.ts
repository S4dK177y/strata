import { createRoute } from "@hono/zod-openapi";
import {
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  SavingsRuleCreateRequestSchema,
  SavingsRuleResponseSchema,
  SavingsRulesListResponseSchema,
  SavingsRuleUpdateRequestSchema,
  type SavingsRule,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type SavingsRuleRow = Database["public"]["Tables"]["savings_rules"]["Row"];

const ELIGIBLE_SAVINGS_ACCOUNT_TYPES = new Set(["savings", "deposit", "debit"]);

function serializeSavingsRuleRow(row: SavingsRuleRow): SavingsRule {
  return {
    id: row.id,
    user_id: row.user_id,
    account_id: row.account_id,
    accrual_type: row.accrual_type as SavingsRule["accrual_type"],
    base_rate: Number(row.base_rate),
    promo_rate: Number(row.promo_rate),
    promo_end_date: row.promo_end_date,
    capitalization: row.capitalization,
    min_balance_override_minor: row.min_balance_override_minor,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const listSavingsRulesRoute = createRoute({
  method: "get",
  path: "/savings-rules",
  tags: ["Savings Rules"],
  summary: "List user's non-deleted savings interest rules",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "List of savings rules",
      content: { "application/json": { schema: SavingsRulesListResponseSchema } },
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
      description: "Failed to load savings rules",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createSavingsRuleRoute = createRoute({
  method: "post",
  path: "/savings-rules",
  tags: ["Savings Rules"],
  summary: "Create or restore a savings interest rule for an account",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SavingsRuleCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Savings rule created",
      content: { "application/json": { schema: SavingsRuleResponseSchema } },
    },
    400: {
      description: "Validation or account reference error",
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
      description: "Active rule already exists for this account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to create savings rule",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateSavingsRuleRoute = createRoute({
  method: "patch",
  path: "/savings-rules/{id}",
  tags: ["Savings Rules"],
  summary: "Update an existing savings interest rule",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: SavingsRuleUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Savings rule updated",
      content: { "application/json": { schema: SavingsRuleResponseSchema } },
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
      description: "Savings rule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update savings rule",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteSavingsRuleRoute = createRoute({
  method: "delete",
  path: "/savings-rules/{id}",
  tags: ["Savings Rules"],
  summary: "Soft-delete a savings interest rule",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Savings rule soft-deleted",
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
      description: "Savings rule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete savings rule",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createSavingsRulesRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/savings-rules", requireAuth, requireInviteGate);
  router.use("/savings-rules/*", requireAuth, requireInviteGate);

  router.openapi(listSavingsRulesRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase
      .from("savings_rules")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      return c.json({ error: "SAVINGS_RULES_LOAD_FAILED", message: error.message }, 500);
    }

    return c.json({ savings_rules: (data ?? []).map(serializeSavingsRuleRow) }, 200);
  });

  router.openapi(createSavingsRuleRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");

    const { data: account, error: accErr } = await auth.supabase
      .from("accounts")
      .select("id, type")
      .eq("id", body.account_id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (accErr || !account) {
      return c.json(
        { error: "INVALID_REFERENCE", message: "Referenced account_id was not found" },
        400
      );
    }

    if (!ELIGIBLE_SAVINGS_ACCOUNT_TYPES.has(account.type)) {
      return c.json(
        {
          error: "INVALID_ACCOUNT_TYPE",
          message: "Savings rules are only supported for savings, deposit, or debit accounts",
        },
        400
      );
    }

    // Check existing row without deleted_at filter because account_id has a table-level UNIQUE constraint
    const { data: existing, error: existingErr } = await auth.supabase
      .from("savings_rules")
      .select("*")
      .eq("user_id", auth.userId)
      .eq("account_id", body.account_id)
      .maybeSingle();

    if (existingErr) {
      return c.json({ error: "SAVINGS_RULE_CREATE_FAILED", message: existingErr.message }, 500);
    }

    const normalizedMinBalance =
      body.accrual_type === "min_balance" ? body.min_balance_override_minor : null;
    const normalizedPromoEnd = body.promo_rate > 0 ? body.promo_end_date : null;

    if (existing) {
      if (existing.deleted_at === null) {
        return c.json(
          {
            error: "SAVINGS_RULE_EXISTS",
            message: "A savings rule already exists for this account",
          },
          409
        );
      }

      const { data: revived, error: reviveErr } = await auth.supabase
        .from("savings_rules")
        .update({
          deleted_at: null,
          accrual_type: body.accrual_type,
          base_rate: body.base_rate,
          promo_rate: body.promo_rate,
          promo_end_date: normalizedPromoEnd,
          capitalization: body.capitalization,
          min_balance_override_minor: normalizedMinBalance,
        })
        .eq("id", existing.id)
        .eq("user_id", auth.userId)
        .select("*")
        .single();

      if (reviveErr || !revived) {
        return c.json(
          {
            error: "SAVINGS_RULE_CREATE_FAILED",
            message: reviveErr?.message ?? "Failed to restore savings rule",
          },
          500
        );
      }

      return c.json({ savings_rule: serializeSavingsRuleRow(revived) }, 201);
    }

    const insertRow: Database["public"]["Tables"]["savings_rules"]["Insert"] = {
      user_id: auth.userId,
      account_id: body.account_id,
      accrual_type: body.accrual_type,
      base_rate: body.base_rate,
      promo_rate: body.promo_rate,
      promo_end_date: normalizedPromoEnd,
      capitalization: body.capitalization,
      min_balance_override_minor: normalizedMinBalance,
    };

    const { data, error } = await auth.supabase
      .from("savings_rules")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "SAVINGS_RULE_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ savings_rule: serializeSavingsRuleRow(data) }, 201);
  });

  router.openapi(updateSavingsRuleRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const { data: current, error: currentErr } = await auth.supabase
      .from("savings_rules")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (currentErr) {
      return c.json({ error: "SAVINGS_RULE_UPDATE_FAILED", message: currentErr.message }, 500);
    }
    if (!current) {
      return c.json({ error: "SAVINGS_RULE_NOT_FOUND", message: "Savings rule not found" }, 404);
    }

    const nextAccrualType = body.accrual_type ?? current.accrual_type;
    const nextPromoRate = body.promo_rate ?? Number(current.promo_rate);
    const nextPromoEndDate =
      body.promo_end_date !== undefined ? body.promo_end_date : current.promo_end_date;

    if (nextPromoRate > 0 && !nextPromoEndDate) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "promo_end_date is required when promo_rate > 0",
        },
        400
      );
    }

    const patch: Database["public"]["Tables"]["savings_rules"]["Update"] = {};
    if (body.accrual_type !== undefined) patch.accrual_type = body.accrual_type;
    if (body.base_rate !== undefined) patch.base_rate = body.base_rate;
    if (body.promo_rate !== undefined) patch.promo_rate = body.promo_rate;
    if (body.promo_end_date !== undefined) {
      patch.promo_end_date = nextPromoRate > 0 ? body.promo_end_date : null;
    } else if (body.promo_rate !== undefined && body.promo_rate === 0) {
      patch.promo_end_date = null;
    }
    if (body.capitalization !== undefined) patch.capitalization = body.capitalization;
    if (nextAccrualType === "daily_balance") {
      patch.min_balance_override_minor = null;
    } else if (body.min_balance_override_minor !== undefined) {
      patch.min_balance_override_minor = body.min_balance_override_minor;
    }

    const { data, error } = await auth.supabase
      .from("savings_rules")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "SAVINGS_RULE_UPDATE_FAILED", message: error.message }, 500);
    }
    if (!data) {
      return c.json({ error: "SAVINGS_RULE_NOT_FOUND", message: "Savings rule not found" }, 404);
    }

    return c.json({ savings_rule: serializeSavingsRuleRow(data) }, 200);
  });

  router.openapi(deleteSavingsRuleRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("savings_rules")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "SAVINGS_RULE_DELETE_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json({ error: "SAVINGS_RULE_NOT_FOUND", message: "Savings rule not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
