import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  SYNC_ENTITY_ORDER,
  SyncPullQuerySchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  type SyncChangesBundle,
  type SyncEntityName,
  type SyncMutation,
  type SyncPushResultItem,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

const ENTITY_ORDER_INDEX = new Map<SyncEntityName, number>(
  SYNC_ENTITY_ORDER.map((name, idx) => [name, idx])
);

const syncPullRoute = createRoute({
  method: "get",
  path: "/sync",
  tags: ["Sync"],
  summary: "Incremental delta pull across all user-owned financial entities",
  security: AUTH_SECURITY,
  request: {
    query: SyncPullQuerySchema,
  },
  responses: {
    200: {
      description: "Delta changes grouped by entity (including soft-delete tombstones)",
      content: {
        "application/json": {
          schema: SyncPullResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Invite required when registration_invite_only is enabled",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Sync pull failed",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const syncPushRoute = createRoute({
  method: "post",
  path: "/sync/push",
  tags: ["Sync"],
  summary: "Push offline mutations in FK order with Last-Write-Wins (LWW) conflict resolution",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: SyncPushRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Per-mutation apply/conflict results",
      content: {
        "application/json": {
          schema: SyncPushResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: "Invite required when registration_invite_only is enabled",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

type SyncTableRow<T extends SyncEntityName> = Database["public"]["Tables"][T]["Row"];

interface UntypedSyncQueryBuilder<Row> {
  select: (cols?: string) => UntypedSyncQueryBuilder<Row>;
  eq: (col: string, val: unknown) => UntypedSyncQueryBuilder<Row>;
  gte: (col: string, val: string) => UntypedSyncQueryBuilder<Row>;
  order: (col: string, opts?: { ascending?: boolean }) => UntypedSyncQueryBuilder<Row>;
  limit: (n: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
}

function getSyncSelectBuilder<T extends SyncEntityName>(
  supabase: NonNullable<ApiEnv["Variables"]["auth"]>["supabase"],
  table: T
): UntypedSyncQueryBuilder<SyncTableRow<T>> {
  return (supabase as unknown as { from: (t: string) => UntypedSyncQueryBuilder<SyncTableRow<T>> }).from(
    table
  );
}

async function pullEntityDelta<T extends SyncEntityName>(
  supabase: NonNullable<ApiEnv["Variables"]["auth"]>["supabase"],
  table: T,
  userId: string,
  since: string | undefined,
  limit: number
): Promise<{ rows: SyncTableRow<T>[]; hasMore: boolean; error: string | null }> {
  let query = getSyncSelectBuilder(supabase, table)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true });

  if (since) {
    query = query.gte("updated_at", since);
  }

  const { data, error } = await query.limit(limit + 1);
  if (error) {
    return { rows: [], hasMore: false, error: error.message };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
    error: null,
  };
}

function sortMutationsByFkOrder(mutations: SyncMutation[]): SyncMutation[] {
  return mutations
    .map((mutation, index) => ({ mutation, index }))
    .sort((a, b) => {
      const orderA = ENTITY_ORDER_INDEX.get(a.mutation.entity) ?? 99;
      const orderB = ENTITY_ORDER_INDEX.get(b.mutation.entity) ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map((item) => item.mutation);
}

function compareIsoDesc(serverIso: string, incomingIso: string): boolean {
  const serverMs = Date.parse(serverIso);
  const incomingMs = Date.parse(incomingIso);
  if (Number.isNaN(serverMs) || Number.isNaN(incomingMs)) {
    return serverIso > incomingIso;
  }
  return serverMs > incomingMs;
}

export function createSyncRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/sync", requireAuth, requireInviteGate);
  router.use("/sync/*", requireAuth, requireInviteGate);

  router.openapi(syncPullRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { since, limit } = c.req.valid("query");
    const serverTime = new Date().toISOString();

    const [
      accounts,
      savingsRules,
      categories,
      goals,
      goalTransfers,
      recurringPayments,
      recurringPaymentMarks,
      debts,
      transactions,
    ] = await Promise.all([
      pullEntityDelta(auth.supabase, "accounts", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "savings_rules", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "categories", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "goals", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "goal_transfers", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "recurring_payments", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "recurring_payment_marks", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "debts", auth.userId, since, limit),
      pullEntityDelta(auth.supabase, "transactions", auth.userId, since, limit),
    ]);

    const firstError =
      accounts.error ??
      savingsRules.error ??
      categories.error ??
      goals.error ??
      goalTransfers.error ??
      recurringPayments.error ??
      recurringPaymentMarks.error ??
      debts.error ??
      transactions.error;

    if (firstError) {
      return c.json({ error: "SYNC_PULL_FAILED", message: firstError }, 500);
    }

    const hasMore =
      accounts.hasMore ||
      savingsRules.hasMore ||
      categories.hasMore ||
      goals.hasMore ||
      goalTransfers.hasMore ||
      recurringPayments.hasMore ||
      recurringPaymentMarks.hasMore ||
      debts.hasMore ||
      transactions.hasMore;

    const changes: SyncChangesBundle = {
      accounts: accounts.rows as SyncChangesBundle["accounts"],
      savings_rules: savingsRules.rows.map((row) => ({
        ...row,
        accrual_type: row.accrual_type as SyncChangesBundle["savings_rules"][number]["accrual_type"],
        base_rate: Number(row.base_rate),
        promo_rate: Number(row.promo_rate),
      })),
      categories: categories.rows as SyncChangesBundle["categories"],
      goals: goals.rows as SyncChangesBundle["goals"],
      goal_transfers: goalTransfers.rows as SyncChangesBundle["goal_transfers"],
      recurring_payments: recurringPayments.rows as SyncChangesBundle["recurring_payments"],
      recurring_payment_marks:
        recurringPaymentMarks.rows as SyncChangesBundle["recurring_payment_marks"],
      debts: debts.rows as SyncChangesBundle["debts"],
      transactions: transactions.rows as SyncChangesBundle["transactions"],
    };

    return c.json(
      {
        server_time: serverTime,
        since: since ?? null,
        has_more: hasMore,
        changes,
      },
      200
    );
  });

  router.openapi(syncPushRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const sortedMutations = sortMutationsByFkOrder(body.mutations);
    const results: SyncPushResultItem[] = [];

    for (const mutation of sortedMutations) {
      const table = mutation.entity;
      const existingRes = await auth.supabase
        .from(table)
        .select("id, updated_at, created_at")
        .eq("id", mutation.id)
        .eq("user_id", auth.userId)
        .maybeSingle();

      if (existingRes.error) {
        results.push({
          entity: table,
          id: mutation.id,
          status: "rejected",
          reason: existingRes.error.message,
        });
        continue;
      }

      const existing = existingRes.data as
        | { id: string; updated_at: string; created_at: string }
        | null;

      if (existing && compareIsoDesc(existing.updated_at, mutation.updated_at)) {
        results.push({
          entity: table,
          id: mutation.id,
          status: "conflict_server_wins",
          server_updated_at: existing.updated_at,
          reason: "Server record has a newer updated_at timestamp",
        });
        continue;
      }

      if (mutation.operation === "delete") {
        if (!existing) {
          results.push({
            entity: table,
            id: mutation.id,
            status: "applied",
          });
          continue;
        }

        const deleteRes = await auth.supabase
          .from(table)
          .update({ deleted_at: mutation.updated_at } as never)
          .eq("id", mutation.id)
          .eq("user_id", auth.userId)
          .select("updated_at")
          .single();

        if (deleteRes.error) {
          results.push({
            entity: table,
            id: mutation.id,
            status: "rejected",
            reason: deleteRes.error.message,
          });
          continue;
        }

        const updatedRow = deleteRes.data as { updated_at: string } | null;
        results.push({
          entity: table,
          id: mutation.id,
          status: "applied",
          server_updated_at: updatedRow?.updated_at ?? mutation.updated_at,
        });
        continue;
      }

      const { created_at: payloadCreatedAt, ...restPayload } = mutation.payload;
      const upsertRow = {
        ...restPayload,
        id: mutation.id,
        user_id: auth.userId,
        deleted_at: null,
        created_at: payloadCreatedAt ?? existing?.created_at ?? mutation.updated_at,
      };

      const upsertRes = await auth.supabase
        .from(table)
        .upsert(upsertRow as never, { onConflict: "id" })
        .select("updated_at")
        .single();

      if (upsertRes.error) {
        results.push({
          entity: table,
          id: mutation.id,
          status: "rejected",
          reason: upsertRes.error.message,
        });
        continue;
      }

      const savedRow = upsertRes.data as { updated_at: string } | null;
      results.push({
        entity: table,
        id: mutation.id,
        status: "applied",
        server_updated_at: savedRow?.updated_at ?? mutation.updated_at,
      });
    }

    return c.json(
      {
        server_time: new Date().toISOString(),
        results,
      },
      200
    );
  });

  return router;
}
