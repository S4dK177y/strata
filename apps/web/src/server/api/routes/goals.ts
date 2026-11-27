import { createRoute } from "@hono/zod-openapi";
import {
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  GoalCreateRequestSchema,
  GoalResponseSchema,
  GoalsListQuerySchema,
  GoalsListResponseSchema,
  GoalTransferCreateRequestSchema,
  GoalTransferResponseSchema,
  GoalTransfersListQuerySchema,
  GoalTransfersListResponseSchema,
  GoalUpdateRequestSchema,
  type Goal,
  type GoalTransfer,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type GoalTransferRow = Database["public"]["Tables"]["goal_transfers"]["Row"];

function serializeGoalRow(row: GoalRow): Goal {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    priority: row.priority as Goal["priority"],
    target_amount_minor: row.target_amount_minor,
    initial_amount_minor: row.initial_amount_minor,
    monthly_plan_minor: row.monthly_plan_minor,
    storage_account_id: row.storage_account_id,
    is_archived: row.is_archived,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function serializeGoalTransferRow(row: GoalTransferRow): GoalTransfer {
  return {
    id: row.id,
    user_id: row.user_id,
    from_goal_id: row.from_goal_id,
    to_goal_id: row.to_goal_id,
    amount_minor: row.amount_minor,
    occurred_at: row.occurred_at,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

async function verifyOwnedAccountExists(
  supabase: AppSupabaseClient,
  userId: string,
  accountId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  return !error && Boolean(data);
}

async function verifyOwnedGoalExists(
  supabase: AppSupabaseClient,
  userId: string,
  goalId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  return !error && Boolean(data);
}

const listGoalsRoute = createRoute({
  method: "get",
  path: "/goals",
  tags: ["Goals"],
  summary: "List user's non-deleted goals and internal goal transfers",
  security: AUTH_SECURITY,
  request: {
    query: GoalsListQuerySchema,
  },
  responses: {
    200: {
      description: "List of goals and goal transfers",
      content: { "application/json": { schema: GoalsListResponseSchema } },
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
      description: "Failed to load goals",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createGoalRoute = createRoute({
  method: "post",
  path: "/goals",
  tags: ["Goals"],
  summary: "Create a virtual goal envelope",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GoalCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Goal created",
      content: { "application/json": { schema: GoalResponseSchema } },
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
    500: {
      description: "Failed to create goal",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateGoalRoute = createRoute({
  method: "patch",
  path: "/goals/{id}",
  tags: ["Goals"],
  summary: "Update or archive a virtual goal envelope",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: GoalUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Goal updated",
      content: { "application/json": { schema: GoalResponseSchema } },
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
    404: {
      description: "Goal not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update goal",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteGoalRoute = createRoute({
  method: "delete",
  path: "/goals/{id}",
  tags: ["Goals"],
  summary: "Soft-delete a virtual goal envelope",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Goal soft-deleted",
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
      description: "Goal not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete goal",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const listGoalTransfersRoute = createRoute({
  method: "get",
  path: "/goal-transfers",
  tags: ["Goals"],
  summary: "List user's non-deleted internal goal transfers",
  security: AUTH_SECURITY,
  request: {
    query: GoalTransfersListQuerySchema,
  },
  responses: {
    200: {
      description: "List of goal transfers",
      content: { "application/json": { schema: GoalTransfersListResponseSchema } },
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
      description: "Failed to load goal transfers",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createGoalTransferRoute = createRoute({
  method: "post",
  path: "/goal-transfers",
  tags: ["Goals"],
  summary: "Reallocate funds virtually between two goal envelopes",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GoalTransferCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Goal transfer created",
      content: { "application/json": { schema: GoalTransferResponseSchema } },
    },
    400: {
      description: "Validation or goal reference error",
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
      description: "Failed to create goal transfer",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteGoalTransferRoute = createRoute({
  method: "delete",
  path: "/goal-transfers/{id}",
  tags: ["Goals"],
  summary: "Soft-delete an internal goal transfer",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Goal transfer soft-deleted",
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
      description: "Goal transfer not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete goal transfer",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createGoalsRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/goals", requireAuth, requireInviteGate);
  router.use("/goals/*", requireAuth, requireInviteGate);
  router.use("/goal-transfers", requireAuth, requireInviteGate);
  router.use("/goal-transfers/*", requireAuth, requireInviteGate);

  router.openapi(listGoalsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { include_archived } = c.req.valid("query");

    let goalsQuery = auth.supabase
      .from("goals")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (include_archived === "false") {
      goalsQuery = goalsQuery.eq("is_archived", false);
    }

    const transfersQuery = auth.supabase
      .from("goal_transfers")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    const [goalsRes, transfersRes] = await Promise.all([goalsQuery, transfersQuery]);

    if (goalsRes.error) {
      return c.json({ error: "GOALS_LOAD_FAILED", message: goalsRes.error.message }, 500);
    }
    if (transfersRes.error) {
      return c.json(
        { error: "GOAL_TRANSFERS_LOAD_FAILED", message: transfersRes.error.message },
        500
      );
    }

    return c.json(
      {
        goals: (goalsRes.data ?? []).map(serializeGoalRow),
        goal_transfers: (transfersRes.data ?? []).map(serializeGoalTransferRow),
      },
      200
    );
  });

  router.openapi(createGoalRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    if (body.storage_account_id) {
      const ok = await verifyOwnedAccountExists(auth.supabase, auth.userId, body.storage_account_id);
      if (!ok) {
        return c.json(
          { error: "INVALID_REFERENCE", message: "Referenced storage_account_id was not found" },
          400
        );
      }
    }

    const insertRow: Database["public"]["Tables"]["goals"]["Insert"] = {
      user_id: auth.userId,
      name: body.name,
      priority: body.priority,
      target_amount_minor: body.target_amount_minor,
      initial_amount_minor: body.initial_amount_minor,
      monthly_plan_minor: body.monthly_plan_minor,
      storage_account_id: body.storage_account_id,
      is_archived: body.is_archived,
      sort_order: body.sort_order,
    };

    const { data, error } = await auth.supabase
      .from("goals")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "GOAL_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ goal: serializeGoalRow(data) }, 201);
  });

  router.openapi(updateGoalRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    if (body.storage_account_id) {
      const ok = await verifyOwnedAccountExists(auth.supabase, auth.userId, body.storage_account_id);
      if (!ok) {
        return c.json(
          { error: "INVALID_REFERENCE", message: "Referenced storage_account_id was not found" },
          400
        );
      }
    }

    const patch: Database["public"]["Tables"]["goals"]["Update"] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.target_amount_minor !== undefined) patch.target_amount_minor = body.target_amount_minor;
    if (body.initial_amount_minor !== undefined) {
      patch.initial_amount_minor = body.initial_amount_minor;
    }
    if (body.monthly_plan_minor !== undefined) patch.monthly_plan_minor = body.monthly_plan_minor;
    if (body.storage_account_id !== undefined) patch.storage_account_id = body.storage_account_id;
    if (body.is_archived !== undefined) patch.is_archived = body.is_archived;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

    const { data, error } = await auth.supabase
      .from("goals")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "GOAL_UPDATE_FAILED", message: error.message }, 500);
    }
    if (!data) {
      return c.json({ error: "GOAL_NOT_FOUND", message: "Goal not found" }, 404);
    }

    return c.json({ goal: serializeGoalRow(data) }, 200);
  });

  router.openapi(deleteGoalRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("goals")
      .update({ deleted_at: deletedAt, is_archived: true })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "GOAL_DELETE_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json({ error: "GOAL_NOT_FOUND", message: "Goal not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  router.openapi(listGoalTransfersRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { goal_id } = c.req.valid("query");
    let query = auth.supabase
      .from("goal_transfers")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (goal_id) {
      query = query.or(`from_goal_id.eq.${goal_id},to_goal_id.eq.${goal_id}`);
    }

    const { data, error } = await query;
    if (error) {
      return c.json({ error: "GOAL_TRANSFERS_LOAD_FAILED", message: error.message }, 500);
    }

    return c.json({ goal_transfers: (data ?? []).map(serializeGoalTransferRow) }, 200);
  });

  router.openapi(createGoalTransferRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const [fromExists, toExists] = await Promise.all([
      verifyOwnedGoalExists(auth.supabase, auth.userId, body.from_goal_id),
      verifyOwnedGoalExists(auth.supabase, auth.userId, body.to_goal_id),
    ]);

    if (!fromExists) {
      return c.json(
        { error: "INVALID_REFERENCE", message: "Referenced from_goal_id was not found" },
        400
      );
    }
    if (!toExists) {
      return c.json(
        { error: "INVALID_REFERENCE", message: "Referenced to_goal_id was not found" },
        400
      );
    }

    const insertRow: Database["public"]["Tables"]["goal_transfers"]["Insert"] = {
      user_id: auth.userId,
      from_goal_id: body.from_goal_id,
      to_goal_id: body.to_goal_id,
      amount_minor: body.amount_minor,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
      comment: body.comment,
    };

    const { data, error } = await auth.supabase
      .from("goal_transfers")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "GOAL_TRANSFER_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ goal_transfer: serializeGoalTransferRow(data) }, 201);
  });

  router.openapi(deleteGoalTransferRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("goal_transfers")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "GOAL_TRANSFER_DELETE_FAILED", message: error.message }, 500);
    }
    if (!data || !data.deleted_at) {
      return c.json(
        { error: "GOAL_TRANSFER_NOT_FOUND", message: "Goal transfer not found" },
        404
      );
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
