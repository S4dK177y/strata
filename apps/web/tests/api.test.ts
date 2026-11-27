import { describe, expect, it } from "vitest";
import type { AppSupabaseClient, RequestAuthContext } from "@/lib/supabase/server";
import { GET as docsGet } from "@/app/api/docs/route";
import { createApiApp } from "@/server/api/app";
import type { ApiDependencies } from "@/server/api/types";

type RowRecord = Record<string, unknown>;

interface MockDbState {
  feature_flags: RowRecord[];
  profiles: RowRecord[];
  invite_codes: RowRecord[];
  accounts: RowRecord[];
  savings_rules: RowRecord[];
  categories: RowRecord[];
  goals: RowRecord[];
  goal_transfers: RowRecord[];
  recurring_payments: RowRecord[];
  recurring_payment_marks: RowRecord[];
  debts: RowRecord[];
  transactions: RowRecord[];
}

function createDefaultDbState(): MockDbState {
  const now = "2026-11-26T04:00:00.000Z";
  return {
    feature_flags: [
      {
        key: "registration_invite_only",
        enabled: true,
        starts_at: null,
        ends_at: null,
        admin_preview: false,
        config: {},
        updated_at: now,
      },
      {
        key: "wrapped_2026",
        enabled: false,
        starts_at: null,
        ends_at: null,
        admin_preview: true,
        config: {},
        updated_at: now,
      },
    ],
    profiles: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        role: "user",
        display_name: "Invited User",
        locale: "ru",
        base_currency: "RUB",
        theme: "dark",
        privacy_blur_default: false,
        onboarding_completed: true,
        invite_redeemed_at: now,
        wrapped_settings: {},
        created_at: now,
        updated_at: now,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        role: "user",
        display_name: "Uninvited User",
        locale: "en",
        base_currency: "USD",
        theme: "light",
        privacy_blur_default: false,
        onboarding_completed: false,
        invite_redeemed_at: null,
        wrapped_settings: {},
        created_at: now,
        updated_at: now,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "admin",
        display_name: "Admin User",
        locale: "ru",
        base_currency: "RUB",
        theme: "system",
        privacy_blur_default: true,
        onboarding_completed: true,
        invite_redeemed_at: null,
        wrapped_settings: {},
        created_at: now,
        updated_at: now,
      },
    ],
    invite_codes: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        code: "STRATA-2026",
        max_uses: 5,
        used_count: 0,
        expires_at: null,
        note: null,
        is_active: true,
        created_by: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        created_at: now,
        updated_at: now,
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        code: "EXPIRED-CODE",
        max_uses: 1,
        used_count: 1,
        expires_at: null,
        note: null,
        is_active: true,
        created_by: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        created_at: now,
        updated_at: now,
      },
    ],
    accounts: [],
    savings_rules: [],
    categories: [],
    goals: [],
    goal_transfers: [],
    recurring_payments: [],
    recurring_payment_marks: [],
    debts: [],
    transactions: [],
  };
}

class MockQueryBuilder {
  private filters: Array<(row: RowRecord) => boolean> = [];
  private orderBys: Array<{ col: string; asc: boolean }> = [];
  private maxRows: number | null = null;
  private rangeSlice: { from: number; to: number } | null = null;
  private wantsExactCount = false;
  private mode: "select" | "update" | "upsert" | "insert" | "delete" = "select";
  private mutationPayload: RowRecord | null = null;
  private insertRows: RowRecord[] = [];

  constructor(
    private readonly state: MockDbState,
    private readonly table: keyof MockDbState,
    private readonly onWrite?: (table: keyof MockDbState, op: string) => void
  ) {}

  select(_cols?: string, opts?: { count?: "exact" }) {
    if (opts?.count === "exact") {
      this.wantsExactCount = true;
    }
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  is(col: string, val: null | boolean) {
    this.filters.push((row) => (row[col] ?? null) === val);
    return this;
  }

  gte(col: string, val: string) {
    this.filters.push((row) => String(row[col] ?? "") >= val);
    return this;
  }

  lte(col: string, val: string) {
    this.filters.push((row) => String(row[col] ?? "") <= val);
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = pattern.replace(/^%|%$/g, "").replace(/\\([%_\\])/g, "$1").toLowerCase();
    this.filters.push((row) => String(row[col] ?? "").toLowerCase().includes(clean));
    return this;
  }

  or(expr: string) {
    const clauses = expr.split(",").map((part) => part.trim());
    this.filters.push((row) =>
      clauses.some((clause) => {
        const [col, op, ...rest] = clause.split(".");
        const val = rest.join(".");
        if (op === "eq" && col) {
          return String(row[col] ?? "") === val;
        }
        return false;
      })
    );
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBys.push({ col, asc: opts?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.maxRows = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeSlice = { from, to };
    return this;
  }

  update(payload: RowRecord) {
    this.mode = "update";
    this.mutationPayload = payload;
    return this;
  }

  upsert(payload: RowRecord) {
    this.mode = "upsert";
    this.mutationPayload = payload;
    return this;
  }

  insert(payload: RowRecord | RowRecord[]) {
    this.mode = "insert";
    this.insertRows = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  private execute(): {
    rows: RowRecord[];
    totalCount: number | null;
    error: { code?: string; message: string } | null;
  } {
    const rows = this.state[this.table];

    if (this.mode === "delete") {
      this.onWrite?.(this.table, "delete");
      const deleted: RowRecord[] = [];
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row && this.filters.every((fn) => fn(row))) {
          deleted.push({ ...row });
          rows.splice(i, 1);
        }
      }
      return { rows: deleted.reverse(), totalCount: deleted.length, error: null };
    }

    if (this.mode === "update" && this.mutationPayload) {
      this.onWrite?.(this.table, "update");
      const now = new Date().toISOString();
      const updated: RowRecord[] = [];
      for (const row of rows) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, this.mutationPayload, { updated_at: now });
          updated.push({ ...row });
        }
      }
      return { rows: updated, totalCount: updated.length, error: null };
    }

    if (this.mode === "upsert" && this.mutationPayload) {
      this.onWrite?.(this.table, "upsert");
      const now = new Date().toISOString();
      const idx = rows.findIndex((r) => r.id === this.mutationPayload?.id);
      if (idx >= 0) {
        const nextRow = { ...rows[idx], ...this.mutationPayload, updated_at: now };
        rows[idx] = nextRow;
        return { rows: [{ ...nextRow }], totalCount: 1, error: null };
      }
      const inserted = { ...this.mutationPayload, updated_at: now };
      rows.push(inserted);
      return { rows: [{ ...inserted }], totalCount: 1, error: null };
    }

    if (this.mode === "insert") {
      if (this.table === "invite_codes") {
        const duplicate = this.insertRows.find((candidate) =>
          rows.some((existing) => existing.code === candidate.code)
        );
        if (duplicate) {
          return {
            rows: [],
            totalCount: 0,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          };
        }
      }
      this.onWrite?.(this.table, "insert");
      const now = new Date().toISOString();
      const inserted = this.insertRows.map((row, idx) => ({
        id: row.id ?? `00000000-0000-4000-8000-${String(rows.length + idx + 1).padStart(12, "0")}`,
        created_at: now,
        updated_at: now,
        ...(this.table === "invite_codes" ? { used_count: 0 } : { deleted_at: null }),
        ...row,
      }));
      rows.push(...inserted);
      return { rows: inserted.map((r) => ({ ...r })), totalCount: inserted.length, error: null };
    }

    let result = rows.filter((row) => this.filters.every((fn) => fn(row)));
    const totalCount = result.length;

    if (this.orderBys.length > 0) {
      result = [...result].sort((a, b) => {
        for (const { col, asc } of this.orderBys) {
          const av = a[col];
          const bv = b[col];
          if (typeof av === "number" && typeof bv === "number") {
            if (av !== bv) return asc ? av - bv : bv - av;
            continue;
          }
          const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
          if (cmp !== 0) return asc ? cmp : -cmp;
        }
        return 0;
      });
    }
    if (this.rangeSlice !== null) {
      result = result.slice(this.rangeSlice.from, this.rangeSlice.to + 1);
    } else if (this.maxRows !== null) {
      result = result.slice(0, this.maxRows);
    }
    return { rows: result.map((r) => ({ ...r })), totalCount, error: null };
  }

  async maybeSingle() {
    const { rows, error } = this.execute();
    if (error) return { data: null, error };
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const { rows, error } = this.execute();
    if (error) return { data: null, error };
    if (!rows[0]) {
      return { data: null, error: { message: "Row not found" } };
    }
    return { data: rows[0], error: null };
  }

  then<
    TResult1 = {
      data: RowRecord[];
      error: { code?: string; message: string } | null;
      count: number | null;
    },
  >(
    onfulfilled?: (value: {
      data: RowRecord[];
      error: { code?: string; message: string } | null;
      count: number | null;
    }) => TResult1 | PromiseLike<TResult1>
  ) {
    const { rows, totalCount, error } = this.execute();
    const res = {
      data: error ? [] : rows,
      error,
      count: this.wantsExactCount ? totalCount : null,
    };
    return Promise.resolve(res).then(onfulfilled);
  }
}

function createMockClient(
  state: MockDbState,
  onWrite?: (table: keyof MockDbState, op: string) => void,
  currentUserId?: string
): AppSupabaseClient {
  return {
    from(table: keyof MockDbState) {
      return new MockQueryBuilder(state, table, onWrite);
    },
    async rpc(fnName: string, args?: Record<string, unknown>) {
      if (fnName === "get_my_auth_state") {
        return {
          data: [
            {
              session_active: true,
              session_id: "99999999-9999-4999-8999-999999999999",
              current_aal: "aal1",
              mfa_enrolled: false,
              mfa_required: false,
            },
          ],
          error: null,
        };
      }
      if (fnName === "get_admin_telemetry") {
        const caller = state.profiles.find((p) => p.id === currentUserId);
        if (!caller || caller.role !== "admin") {
          return { data: null, error: { code: "42501", message: "Admin privileges required" } };
        }
        return {
          data: {
            total_users: state.profiles.length,
            onboarded_users: state.profiles.filter((p) => p.onboarding_completed === true).length,
            invited_users: state.profiles.filter((p) => p.invite_redeemed_at !== null).length,
            total_accounts: state.accounts.filter((a) => !a.deleted_at).length,
            total_transactions: state.transactions.filter((t) => !t.deleted_at).length,
            transactions_last_30d: state.transactions.filter((t) => !t.deleted_at).length,
            total_goals: state.goals.filter((g) => !g.deleted_at).length,
            total_debts: state.debts.filter((d) => !d.deleted_at).length,
            active_invites: state.invite_codes.filter(
              (i) =>
                i.is_active === true &&
                (i.max_uses === null || Number(i.used_count) < Number(i.max_uses))
            ).length,
            story_views_total: 0,
            generated_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      if (fnName === "redeem_invite_code") {
        const cleanCode = String(args?.p_code ?? "").trim();
        const profile = state.profiles.find((p) => p.id === currentUserId);
        if (!profile) {
          return { data: null, error: { code: "P0002", message: "User profile not found" } };
        }
        if (profile.invite_redeemed_at) {
          return { data: profile.invite_redeemed_at, error: null };
        }
        const invite = state.invite_codes.find(
          (i) =>
            i.code === cleanCode &&
            i.is_active === true &&
            (i.max_uses === null || Number(i.used_count) < Number(i.max_uses))
        );
        if (!invite) {
          return {
            data: null,
            error: { code: "P0001", message: "INVALID_OR_EXPIRED_INVITE_CODE" },
          };
        }
        const now = new Date().toISOString();
        invite.used_count = Number(invite.used_count) + 1;
        profile.invite_redeemed_at = now;
        profile.updated_at = now;
        return { data: now, error: null };
      }
      return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    },
  } as unknown as AppSupabaseClient;
}

function createTestHarness(state: MockDbState = createDefaultDbState()) {
  const writeLog: string[] = [];
  const onWrite = (table: keyof MockDbState, op: string) => writeLog.push(`${op}:${table}`);
  const publicClient = createMockClient(state, onWrite);

  const deps: ApiDependencies = {
    getPublicClient: () => publicClient,
    resolveAuth: async (request: Request): Promise<RequestAuthContext | null> => {
      const auth = request.headers.get("authorization");
      if (!auth) return null;
      if (auth === "Bearer token-invited") {
        const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        return {
          supabase: createMockClient(state, onWrite, userId),
          userId,
          email: "invited@strata.app",
          authMode: "bearer",
          sessionId: "99999999-9999-4999-8999-999999999999",
          aal: "aal1",
        };
      }
      if (auth === "Bearer token-uninvited") {
        const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        return {
          supabase: createMockClient(state, onWrite, userId),
          userId,
          email: "uninvited@strata.app",
          authMode: "bearer",
          sessionId: "99999999-9999-4999-8999-999999999999",
          aal: "aal1",
        };
      }
      if (auth === "Bearer token-admin") {
        const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        return {
          supabase: createMockClient(state, onWrite, userId),
          userId,
          email: "admin@strata.app",
          authMode: "bearer",
          sessionId: "99999999-9999-4999-8999-999999999999",
          aal: "aal1",
        };
      }
      return null;
    },
  };

  return { app: createApiApp(deps), state, writeLog };
}

describe("Strata Hono OpenAPI 3.1 API & Sync", () => {
  it("serves /api/v1/health with db status", async () => {
    const { app } = createTestHarness();
    const res = await app.request("http://localhost/api/v1/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.status).toBe("ok");
    expect(json.app).toBe("strata");
    expect(json.db).toBe("ok");
  });

  it("generates OpenAPI 3.1.0 spec and serves Scalar UI on /api/docs", async () => {
    const { app } = createTestHarness();
    const specRes = await app.request("http://localhost/api/v1/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/api/v1/health",
        "/api/v1/feature-flags",
        "/api/v1/me",
        "/api/v1/invites/redeem",
        "/api/v1/onboarding/complete",
        "/api/v1/accounts",
        "/api/v1/accounts/{id}",
        "/api/v1/categories",
        "/api/v1/categories/{id}",
        "/api/v1/transactions",
        "/api/v1/transactions/{id}",
        "/api/v1/sync",
        "/api/v1/sync/push",
      ])
    );

    const docsRes = await docsGet(new Request("http://localhost/api/docs"));
    expect(docsRes.status).toBe(200);
    const html = await docsRes.text();
    expect(html).toContain("/api/v1/openapi.json");
    expect(html).toContain("Strata API Docs");
  });

  it("hides admin_preview-only flags from public callers but reveals them to admin", async () => {
    const { app } = createTestHarness();

    const anonRes = await app.request("http://localhost/api/v1/feature-flags");
    expect(anonRes.status).toBe(200);
    const anonJson = (await anonRes.json()) as { flags: Array<{ key: string }> };
    expect(anonJson.flags.map((f) => f.key)).toEqual(["registration_invite_only"]);

    const adminRes = await app.request("http://localhost/api/v1/feature-flags", {
      headers: { Authorization: "Bearer token-admin" },
    });
    expect(adminRes.status).toBe(200);
    const adminJson = (await adminRes.json()) as { flags: Array<{ key: string }> };
    expect(adminJson.flags.map((f) => f.key)).toEqual([
      "registration_invite_only",
      "wrapped_2026",
    ]);
  });

  it("rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
    const { app } = createTestHarness();

    for (const path of ["/api/v1/me", "/api/v1/sync"]) {
      const res = await app.request(`http://localhost${path}`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("UNAUTHORIZED");
    }
  });

  it("enforces Invite Gate on financial endpoints while allowing /me", async () => {
    const { app } = createTestHarness();

    const meRes = await app.request("http://localhost/api/v1/me", {
      headers: { Authorization: "Bearer token-uninvited" },
    });
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { invite_required: boolean };
    expect(meJson.invite_required).toBe(true);

    const syncRes = await app.request("http://localhost/api/v1/sync", {
      headers: { Authorization: "Bearer token-uninvited" },
    });
    expect(syncRes.status).toBe(403);
    const syncJson = (await syncRes.json()) as { error: string };
    expect(syncJson.error).toBe("INVITE_REQUIRED");

    const adminSyncRes = await app.request("http://localhost/api/v1/sync", {
      headers: { Authorization: "Bearer token-admin" },
    });
    expect(adminSyncRes.status).toBe(200);
  });

  it("pushes mutations in FK order, detects LWW server conflicts, and pulls delta + tombstones", async () => {
    const { app, state, writeLog } = createTestHarness();
    const accountId = "11111111-1111-4111-8111-111111111111";
    const txId = "22222222-2222-4222-8222-222222222222";
    const staleCatId = "33333333-3333-4333-8333-333333333333";

    state.categories.push({
      id: staleCatId,
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Server Newer Category",
      kind: "expense",
      is_passive: false,
      monthly_limit_minor: null,
      icon: null,
      color: null,
      hint: null,
      sort_order: 0,
      created_at: "2026-11-26T04:00:00.000Z",
      updated_at: "2026-11-26T05:00:00.000Z",
      deleted_at: null,
    });

    // Send transaction BEFORE account intentionally to verify server FK sorting
    const pushRes = await app.request("http://localhost/api/v1/sync/push", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [
          {
            entity: "transactions",
            operation: "upsert",
            id: txId,
            updated_at: "2026-11-26T04:30:00.000Z",
            payload: {
              occurred_at: "2026-11-26T04:25:00.000Z",
              type: "expense",
              amount_minor: 45000,
              account_from_id: accountId,
              comment: "Coffee",
              source: "android",
            },
          },
          {
            entity: "categories",
            operation: "upsert",
            id: staleCatId,
            updated_at: "2026-11-26T04:10:00.000Z",
            payload: {
              name: "Stale Client Name",
              kind: "expense",
            },
          },
          {
            entity: "accounts",
            operation: "upsert",
            id: accountId,
            updated_at: "2026-11-26T04:20:00.000Z",
            payload: {
              name: "Main Debit",
              type: "debit",
              currency: "RUB",
              initial_balance_minor: 100000,
            },
          },
        ],
      }),
    });

    expect(pushRes.status).toBe(200);
    const pushJson = (await pushRes.json()) as {
      results: Array<{ entity: string; id: string; status: string }>;
    };

    expect(writeLog).toEqual(["upsert:accounts", "upsert:transactions"]);
    expect(pushJson.results).toEqual([
      expect.objectContaining({ entity: "accounts", id: accountId, status: "applied" }),
      expect.objectContaining({
        entity: "categories",
        id: staleCatId,
        status: "conflict_server_wins",
      }),
      expect.objectContaining({ entity: "transactions", id: txId, status: "applied" }),
    ]);

    // Soft-delete transaction with a timestamp strictly newer than server upsert
    const futureDeleteAt = new Date(Date.now() + 60_000).toISOString();
    const deleteRes = await app.request("http://localhost/api/v1/sync/push", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [
          {
            entity: "transactions",
            operation: "delete",
            id: txId,
            updated_at: futureDeleteAt,
          },
        ],
      }),
    });
    expect(deleteRes.status).toBe(200);

    // Pull delta includes tombstone
    const pullRes = await app.request(
      "http://localhost/api/v1/sync?since=2026-11-26T04:00:00.000Z",
      {
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(pullRes.status).toBe(200);
    const pullJson = (await pullRes.json()) as {
      has_more: boolean;
      changes: {
        accounts: Array<{ id: string }>;
        transactions: Array<{ id: string; deleted_at: string | null }>;
      };
    };
    expect(pullJson.has_more).toBe(false);
    expect(pullJson.changes.accounts).toHaveLength(1);
    expect(pullJson.changes.transactions[0]?.deleted_at).toBe(futureDeleteAt);
  });

  it("allows PATCH /api/v1/me without invite redemption and validates non-empty payload", async () => {
    const { app } = createTestHarness();

    const emptyRes = await app.request("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(emptyRes.status).toBe(400);

    const patchRes = await app.request("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        display_name: "Elena",
        locale: "ru",
        theme: "dark",
        privacy_blur_default: true,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchJson = (await patchRes.json()) as {
      profile: {
        display_name: string;
        locale: string;
        theme: string;
        privacy_blur_default: boolean;
      };
      invite_required: boolean;
    };
    expect(patchJson.profile.display_name).toBe("Elena");
    expect(patchJson.profile.locale).toBe("ru");
    expect(patchJson.profile.theme).toBe("dark");
    expect(patchJson.profile.privacy_blur_default).toBe(true);
    expect(patchJson.invite_required).toBe(true);
  });

  it("redeems valid invite codes, rejects invalid codes, and unlocks financial endpoints", async () => {
    const { app } = createTestHarness();

    const badRes = await app.request("http://localhost/api/v1/invites/redeem", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "EXPIRED-CODE" }),
    });
    expect(badRes.status).toBe(400);
    const badJson = (await badRes.json()) as { error: string };
    expect(badJson.error).toBe("INVALID_OR_EXPIRED_INVITE_CODE");

    const okRes = await app.request("http://localhost/api/v1/invites/redeem", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "STRATA-2026" }),
    });
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as {
      invite_redeemed_at: string;
      invite_required: boolean;
    };
    expect(okJson.invite_required).toBe(false);
    expect(okJson.invite_redeemed_at).toBeTruthy();

    const syncAfterRes = await app.request("http://localhost/api/v1/sync", {
      headers: { Authorization: "Bearer token-uninvited" },
    });
    expect(syncAfterRes.status).toBe(200);
  });

  it("enforces invite gate on /onboarding/complete and seeds starter accounts & categories", async () => {
    const { app, state } = createTestHarness();

    const blockedRes = await app.request("http://localhost/api/v1/onboarding/complete", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locale: "en",
        base_currency: "USD",
        theme: "system",
        privacy_blur_default: false,
      }),
    });
    expect(blockedRes.status).toBe(403);
    const blockedJson = (await blockedRes.json()) as { error: string };
    expect(blockedJson.error).toBe("INVITE_REQUIRED");

    const redeemRes = await app.request("http://localhost/api/v1/invites/redeem", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "STRATA-2026" }),
    });
    expect(redeemRes.status).toBe(200);

    const completeRes = await app.request("http://localhost/api/v1/onboarding/complete", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-uninvited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        display_name: "Sam",
        locale: "en",
        base_currency: "USD",
        theme: "dark",
        privacy_blur_default: true,
        accounts: [
          {
            name: "Main Checking",
            type: "debit",
            currency: "USD",
            initial_balance_minor: 250000,
          },
        ],
        categories: [
          {
            name: "Groceries",
            kind: "expense",
            is_passive: false,
          },
          {
            name: "Cashback",
            kind: "income",
            is_passive: true,
          },
        ],
      }),
    });
    expect(completeRes.status).toBe(200);
    const completeJson = (await completeRes.json()) as {
      profile: { onboarding_completed: boolean; base_currency: string; theme: string };
      created_accounts_count: number;
      created_categories_count: number;
    };
    expect(completeJson.profile.onboarding_completed).toBe(true);
    expect(completeJson.profile.base_currency).toBe("USD");
    expect(completeJson.profile.theme).toBe("dark");
    expect(completeJson.created_accounts_count).toBe(1);
    expect(completeJson.created_categories_count).toBe(2);
    expect(state.accounts).toHaveLength(1);
    expect(state.categories).toHaveLength(2);
  });

  it("enforces invite gate and supports Accounts & Categories CRUD with soft delete", async () => {
    const { app } = createTestHarness();

    for (const path of ["/api/v1/accounts", "/api/v1/categories", "/api/v1/transactions"]) {
      const blocked = await app.request(`http://localhost${path}`, {
        headers: { Authorization: "Bearer token-uninvited" },
      });
      expect(blocked.status).toBe(403);
      const json = (await blocked.json()) as { error: string };
      expect(json.error).toBe("INVITE_REQUIRED");
    }

    // Create Credit Card with negative initial balance
    const accCreateRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Tinkoff Black Credit",
        type: "credit",
        currency: "RUB",
        initial_balance_minor: -1500000,
        credit_limit_minor: 10000000,
        bank_name: "T-Bank",
        last4_digits: "4242",
      }),
    });
    expect(accCreateRes.status).toBe(201);
    const { account: createdAcc } = (await accCreateRes.json()) as {
      account: { id: string; initial_balance_minor: number; is_active: boolean };
    };
    expect(createdAcc.initial_balance_minor).toBe(-1500000);
    expect(createdAcc.is_active).toBe(true);

    // Archive account via PATCH
    const accPatchRes = await app.request(`http://localhost/api/v1/accounts/${createdAcc.id}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: false, name: "Archived Card" }),
    });
    expect(accPatchRes.status).toBe(200);

    const activeOnlyRes = await app.request("http://localhost/api/v1/accounts?active_only=true", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(activeOnlyRes.status).toBe(200);
    expect(((await activeOnlyRes.json()) as { accounts: unknown[] }).accounts).toHaveLength(0);

    // Soft-delete account and confirm tombstone appears in /sync
    const accDeleteRes = await app.request(`http://localhost/api/v1/accounts/${createdAcc.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(accDeleteRes.status).toBe(200);

    const syncRes = await app.request("http://localhost/api/v1/sync", {
      headers: { Authorization: "Bearer token-invited" },
    });
    const syncJson = (await syncRes.json()) as {
      changes: { accounts: Array<{ id: string; deleted_at: string | null }> };
    };
    expect(syncJson.changes.accounts[0]?.deleted_at).toBeTruthy();

    // Categories CRUD & passive-expense validation
    const invalidCatRes = await app.request("http://localhost/api/v1/categories", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Invalid",
        kind: "expense",
        is_passive: true,
      }),
    });
    expect(invalidCatRes.status).toBe(400);

    const catCreateRes = await app.request("http://localhost/api/v1/categories", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Groceries",
        kind: "expense",
        monthly_limit_minor: 3000000,
        icon: "shopping-cart",
      }),
    });
    expect(catCreateRes.status).toBe(201);
    const { category: createdCat } = (await catCreateRes.json()) as {
      category: { id: string; monthly_limit_minor: number | null };
    };
    expect(createdCat.monthly_limit_minor).toBe(3000000);

    const catDeleteRes = await app.request(`http://localhost/api/v1/categories/${createdCat.id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(catDeleteRes.status).toBe(200);
  });

  it("handles all transaction types, reference validation, filters, pagination, and draft confirmation", async () => {
    const { app, state } = createTestHarness();

    // Seed two accounts for invited user and one foreign account
    const acc1Res = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Main Debit", type: "debit", currency: "RUB" }),
    });
    const acc1 = ((await acc1Res.json()) as { account: { id: string } }).account;

    const acc2Res = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Savings Vault", type: "savings", currency: "RUB" }),
    });
    const acc2 = ((await acc2Res.json()) as { account: { id: string } }).account;

    const catRes = await app.request("http://localhost/api/v1/categories", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Dining", kind: "expense" }),
    });
    const cat = ((await catRes.json()) as { category: { id: string } }).category;

    state.accounts.push({
      id: "99999999-9999-4999-8999-999999999999",
      user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Foreign Account",
      type: "debit",
      currency: "RUB",
      initial_balance_minor: 0,
      credit_limit_minor: 0,
      bank_name: null,
      last4_digits: null,
      is_active: true,
      sort_order: 0,
      created_at: "2026-11-26T04:00:00.000Z",
      updated_at: "2026-11-26T04:00:00.000Z",
      deleted_at: null,
    });

    // Reject foreign account reference
    const foreignRefRes = await app.request("http://localhost/api/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        occurred_at: "2026-11-26T10:00:00.000Z",
        type: "expense",
        amount_minor: 50000,
        account_from_id: "99999999-9999-4999-8999-999999999999",
      }),
    });
    expect(foreignRefRes.status).toBe(400);
    expect(((await foreignRefRes.json()) as { error: string }).error).toBe("INVALID_REFERENCE");

    // Reject confirmed transfer with identical accounts
    const badTransferRes = await app.request("http://localhost/api/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        occurred_at: "2026-11-26T10:00:00.000Z",
        type: "transfer",
        amount_minor: 50000,
        account_from_id: acc1.id,
        account_to_id: acc1.id,
      }),
    });
    expect(badTransferRes.status).toBe(400);

    // Create expense, compensation, transfer, debt_given, and draft
    const txs = [
      {
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "expense",
        amount_minor: 50500,
        account_from_id: acc1.id,
        category_id: cat.id,
        comment: "Team lunch",
      },
      {
        occurred_at: "2026-11-26T13:00:00.000Z",
        type: "compensation",
        amount_minor: 25000,
        account_from_id: acc1.id,
        category_id: cat.id,
        comment: "Split lunch refund",
      },
      {
        occurred_at: "2026-11-26T14:00:00.000Z",
        type: "transfer",
        amount_minor: 100000,
        account_from_id: acc1.id,
        account_to_id: acc2.id,
        comment: "Move to savings",
      },
      {
        occurred_at: "2026-11-26T15:00:00.000Z",
        type: "debt_given",
        amount_minor: 30000,
        account_from_id: acc1.id,
        comment: "Ivan taxi",
      },
      {
        occurred_at: "2026-11-26T16:00:00.000Z",
        type: "expense",
        amount_minor: 19900,
        account_from_id: null,
        comment: "Draft coffee",
        status: "draft",
      },
    ];

    const createdIds: string[] = [];
    for (const payload of txs) {
      const res = await app.request("http://localhost/api/v1/transactions", {
        method: "POST",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(201);
      const { transaction } = (await res.json()) as { transaction: { id: string } };
      createdIds.push(transaction.id);
    }

    // Filter by destination account_id (should include the transfer to acc2)
    const acc2FilterRes = await app.request(
      `http://localhost/api/v1/transactions?account_id=${acc2.id}`,
      { headers: { Authorization: "Bearer token-invited" } }
    );
    expect(acc2FilterRes.status).toBe(200);
    const acc2FilterJson = (await acc2FilterRes.json()) as {
      transactions: Array<{ type: string }>;
      total: number;
    };
    expect(acc2FilterJson.total).toBe(1);
    expect(acc2FilterJson.transactions[0]?.type).toBe("transfer");

    // Search + pagination
    const page1Res = await app.request(
      "http://localhost/api/v1/transactions?limit=2&offset=0",
      { headers: { Authorization: "Bearer token-invited" } }
    );
    const page1Json = (await page1Res.json()) as {
      transactions: unknown[];
      total: number;
      has_more: boolean;
    };
    expect(page1Json.total).toBe(5);
    expect(page1Json.transactions).toHaveLength(2);
    expect(page1Json.has_more).toBe(true);

    const searchRes = await app.request(
      "http://localhost/api/v1/transactions?search=lunch",
      { headers: { Authorization: "Bearer token-invited" } }
    );
    const searchJson = (await searchRes.json()) as { total: number };
    expect(searchJson.total).toBe(2);

    // Confirm draft via PATCH
    const draftId = createdIds[4];
    const confirmDraftRes = await app.request(
      `http://localhost/api/v1/transactions/${draftId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "confirmed", account_from_id: acc1.id }),
      }
    );
    expect(confirmDraftRes.status).toBe(200);
    expect(
      ((await confirmDraftRes.json()) as { transaction: { status: string } }).transaction.status
    ).toBe("confirmed");

    // Switch transfer -> expense auto-clears account_to_id
    const transferId = createdIds[2];
    const switchRes = await app.request(
      `http://localhost/api/v1/transactions/${transferId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "expense", category_id: cat.id }),
      }
    );
    expect(switchRes.status).toBe(200);
    const switched = ((await switchRes.json()) as {
      transaction: { type: string; account_to_id: string | null };
    }).transaction;
    expect(switched.type).toBe("expense");
    expect(switched.account_to_id).toBeNull();

    // Soft-delete transaction
    const delRes = await app.request(`http://localhost/api/v1/transactions/${draftId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(delRes.status).toBe(200);
  });

  it("updates tour_completed_at via PATCH /api/v1/me and exports JSON & formula-safe CSV", async () => {
    const { app } = createTestHarness();
    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const tourTs = "2026-11-26T21:00:00.000Z";
    const patchTourRes = await app.request("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tour_completed_at: tourTs,
        dashboard_layout: ["accounts", "recent_operations", "analytics_kpis"],
      }),
    });
    expect(patchTourRes.status).toBe(200);
    const patchTourJson = (await patchTourRes.json()) as {
      profile: { tour_completed_at: string | null; dashboard_layout: string[] | null };
    };
    expect(patchTourJson.profile.tour_completed_at).toBe(tourTs);
    expect(patchTourJson.profile.dashboard_layout).toEqual([
      "accounts",
      "recent_operations",
      "analytics_kpis",
    ]);

    // Seed account, category, and formula-injection test transaction
    const accRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Main Card",
        type: "debit",
        currency: "RUB",
        initial_balance_minor: 500000,
      }),
    });
    const { account } = (await accRes.json()) as { account: { id: string } };

    const catRes = await app.request("http://localhost/api/v1/categories", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Продукты",
        kind: "expense",
      }),
    });
    const { category } = (await catRes.json()) as { category: { id: string } };

    await app.request("http://localhost/api/v1/transactions", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "expense",
        amount_minor: 15055,
        account_from_id: account.id,
        category_id: category.id,
        comment: "=SUM(A1:A2), Coffee",
      }),
    });

    const jsonExportRes = await app.request("http://localhost/api/v1/export/json", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(jsonExportRes.status).toBe(200);
    expect(jsonExportRes.headers.get("content-disposition")).toContain("strata-backup-");
    const jsonSnapshot = (await jsonExportRes.json()) as {
      schema_version: string;
      accounts: Array<{ user_id: string }>;
      transactions: Array<{ amount_minor: number }>;
    };
    expect(jsonSnapshot.schema_version).toBe("1.0");
    expect(jsonSnapshot.accounts.every((a) => a.user_id === userId)).toBe(true);
    expect(jsonSnapshot.transactions[0]?.amount_minor).toBe(15055);

    const csvExportRes = await app.request("http://localhost/api/v1/export/csv", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(csvExportRes.status).toBe(200);
    expect(csvExportRes.headers.get("content-type")).toContain("text/csv");
    const csvBytes = new Uint8Array(await csvExportRes.arrayBuffer());
    // UTF-8 BOM: EF BB BF
    expect(Array.from(csvBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csvText = new TextDecoder("utf-8", { ignoreBOM: true }).decode(csvBytes);
    expect(csvText.startsWith("\uFEFF")).toBe(true);
    expect(csvText).toContain("15055,150.55,RUB,Main Card,,Продукты,\"'=SUM(A1:A2), Coffee\",web");
  });

  it("enforces 403 ADMIN_REQUIRED for non-admins and supports admin telemetry, invites & flags CRUD", async () => {
    const { app } = createTestHarness();

    const deniedRes = await app.request("http://localhost/api/v1/admin/telemetry", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(deniedRes.status).toBe(403);
    expect(((await deniedRes.json()) as { error: string }).error).toBe("ADMIN_REQUIRED");

    const telemetryRes = await app.request("http://localhost/api/v1/admin/telemetry", {
      headers: { Authorization: "Bearer token-admin" },
    });
    expect(telemetryRes.status).toBe(200);
    const telemetryJson = (await telemetryRes.json()) as {
      telemetry: { total_users: number; active_invites: number };
    };
    expect(telemetryJson.telemetry.total_users).toBe(3);

    // Create unlimited invite (max_uses: null)
    const createUnlimitedRes = await app.request("http://localhost/api/v1/admin/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_uses: null, note: "Unlimited beta" }),
    });
    expect(createUnlimitedRes.status).toBe(201);
    const createdUnlimited = (await createUnlimitedRes.json()) as {
      invite: { id: string; max_uses: number | null };
    };
    expect(createdUnlimited.invite.max_uses).toBeNull();

    // Create invite with auto-generated code
    const createAutoRes = await app.request("http://localhost/api/v1/admin/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_uses: 3, note: "QA invite" }),
    });
    expect(createAutoRes.status).toBe(201);
    const createdAuto = (await createAutoRes.json()) as {
      invite: { id: string; code: string; is_active: boolean };
    };
    expect(createdAuto.invite.code).toMatch(/^STRATA-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Duplicate invite returns 409
    const dupRes = await app.request("http://localhost/api/v1/admin/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-admin",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "STRATA-2026", max_uses: 2 }),
    });
    expect(dupRes.status).toBe(409);

    // Pause invite
    const patchInviteRes = await app.request(
      `http://localhost/api/v1/admin/invites/${createdAuto.invite.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-admin",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: false }),
      }
    );
    expect(patchInviteRes.status).toBe(200);
    expect(
      ((await patchInviteRes.json()) as { invite: { is_active: boolean } }).invite.is_active
    ).toBe(false);

    // Delete invite
    const deleteInviteRes = await app.request(
      `http://localhost/api/v1/admin/invites/${createdAuto.invite.id}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer token-admin" },
      }
    );
    expect(deleteInviteRes.status).toBe(200);

    // Feature flags list + update
    const flagsRes = await app.request("http://localhost/api/v1/admin/feature-flags", {
      headers: { Authorization: "Bearer token-admin" },
    });
    expect(flagsRes.status).toBe(200);
    const flagsJson = (await flagsRes.json()) as { flags: Array<{ key: string }> };
    expect(flagsJson.flags.some((f) => f.key === "wrapped_2026")).toBe(true);

    const patchFlagRes = await app.request(
      "http://localhost/api/v1/admin/feature-flags/wrapped_2026",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-admin",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ admin_preview: false }),
      }
    );
    expect(patchFlagRes.status).toBe(200);
    expect(
      ((await patchFlagRes.json()) as { flag: { admin_preview: boolean } }).flag.admin_preview
    ).toBe(false);
  });

  it("supports PR 7 Savings Rules CRUD, soft-delete resurrection, and type guards", async () => {
    const { app } = createTestHarness();

    // Create a savings account and a credit account
    const savAccRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Sber Savings",
        type: "savings",
        currency: "RUB",
        initial_balance_minor: 5000000,
      }),
    });
    expect(savAccRes.status).toBe(201);
    const savAccId = ((await savAccRes.json()) as { account: { id: string } }).account.id;

    const credAccRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Credit Card",
        type: "credit",
        currency: "RUB",
        credit_limit_minor: 10000000,
      }),
    });
    const credAccId = ((await credAccRes.json()) as { account: { id: string } }).account.id;

    // Reject ineligible credit account
    const badTypeRes = await app.request("http://localhost/api/v1/savings-rules", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: credAccId,
        accrual_type: "daily_balance",
        base_rate: 0.1,
      }),
    });
    expect(badTypeRes.status).toBe(400);
    expect(((await badTypeRes.json()) as { error: string }).error).toBe("INVALID_ACCOUNT_TYPE");

    // Reject unknown account_id
    const missingRefRes = await app.request("http://localhost/api/v1/savings-rules", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: "99999999-9999-4999-8999-999999999999",
        accrual_type: "daily_balance",
        base_rate: 0.1,
      }),
    });
    expect(missingRefRes.status).toBe(400);
    expect(((await missingRefRes.json()) as { error: string }).error).toBe("INVALID_REFERENCE");

    // Create rule
    const createRes = await app.request("http://localhost/api/v1/savings-rules", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: savAccId,
        accrual_type: "min_balance",
        base_rate: 0.1,
        promo_rate: 0.18,
        promo_end_date: "2026-12-31",
        capitalization: true,
        min_balance_override_minor: 4000000,
      }),
    });
    expect(createRes.status).toBe(201);
    const createdRule = ((await createRes.json()) as {
      savings_rule: { id: string; base_rate: number; promo_rate: number };
    }).savings_rule;
    expect(createdRule.base_rate).toBe(0.1);
    expect(createdRule.promo_rate).toBe(0.18);

    // Duplicate active rule returns 409
    const dupRes = await app.request("http://localhost/api/v1/savings-rules", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: savAccId,
        accrual_type: "daily_balance",
        base_rate: 0.12,
      }),
    });
    expect(dupRes.status).toBe(409);
    expect(((await dupRes.json()) as { error: string }).error).toBe("SAVINGS_RULE_EXISTS");

    // Patch rule to daily_balance clears min_balance_override_minor
    const patchRes = await app.request(
      `http://localhost/api/v1/savings-rules/${createdRule.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accrual_type: "daily_balance",
          base_rate: 0.11,
        }),
      }
    );
    expect(patchRes.status).toBe(200);
    const patchedRule = ((await patchRes.json()) as {
      savings_rule: { accrual_type: string; min_balance_override_minor: number | null };
    }).savings_rule;
    expect(patchedRule.accrual_type).toBe("daily_balance");
    expect(patchedRule.min_balance_override_minor).toBeNull();

    // Soft-delete then recreate on same account_id revives row instead of hitting UNIQUE violation
    const delRes = await app.request(
      `http://localhost/api/v1/savings-rules/${createdRule.id}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(delRes.status).toBe(200);

    const reviveRes = await app.request("http://localhost/api/v1/savings-rules", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: savAccId,
        accrual_type: "daily_balance",
        base_rate: 0.14,
      }),
    });
    expect(reviveRes.status).toBe(201);
    const revived = ((await reviveRes.json()) as {
      savings_rule: { id: string; base_rate: number; deleted_at: string | null };
    }).savings_rule;
    expect(revived.id).toBe(createdRule.id);
    expect(revived.base_rate).toBe(0.14);
    expect(revived.deleted_at).toBeNull();

    const listRes = await app.request("http://localhost/api/v1/savings-rules", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(listRes.status).toBe(200);
    expect(
      ((await listRes.json()) as { savings_rules: unknown[] }).savings_rules
    ).toHaveLength(1);
  });

  it("supports PR 7 Recurring Payments CRUD, period marks, and OpenAPI registration", async () => {
    const { app } = createTestHarness();

    const accRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Main Debit",
        type: "debit",
        currency: "RUB",
      }),
    });
    const accId = ((await accRes.json()) as { account: { id: string } }).account.id;

    // Create recurring payment
    const createRes = await app.request("http://localhost/api/v1/recurring-payments", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Home Internet",
        account_id: accId,
        amount_minor: 75000,
        day_of_month: 25,
        cadence: "monthly",
        match_keyword: "Rostelecom",
      }),
    });
    expect(createRes.status).toBe(201);
    const paymentId = ((await createRes.json()) as {
      recurring_payment: { id: string };
    }).recurring_payment.id;

    // Mark paid for 2026-11 (201 then idempotent 200)
    const markRes = await app.request(
      `http://localhost/api/v1/recurring-payments/${paymentId}/marks`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period_key: "2026-11" }),
      }
    );
    expect(markRes.status).toBe(201);

    const markAgainRes = await app.request(
      `http://localhost/api/v1/recurring-payments/${paymentId}/marks`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period_key: "2026-11" }),
      }
    );
    expect(markAgainRes.status).toBe(200);

    // List with period filter
    const listRes = await app.request(
      "http://localhost/api/v1/recurring-payments?period=2026-11",
      {
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      recurring_payments: unknown[];
      marks: Array<{ period_key: string }>;
    };
    expect(listJson.recurring_payments).toHaveLength(1);
    expect(listJson.marks).toHaveLength(1);
    expect(listJson.marks[0]?.period_key).toBe("2026-11");

    // Unmark period
    const unmarkRes = await app.request(
      `http://localhost/api/v1/recurring-payments/${paymentId}/marks/2026-11`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(unmarkRes.status).toBe(200);

    // Patch & Delete recurring payment
    const patchRes = await app.request(
      `http://localhost/api/v1/recurring-payments/${paymentId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer token-invited",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: false }),
      }
    );
    expect(patchRes.status).toBe(200);

    const deleteRes = await app.request(
      `http://localhost/api/v1/recurring-payments/${paymentId}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(deleteRes.status).toBe(200);

    // Verify OpenAPI 3.1 exposes PR 7 routes
    const specRes = await app.request("http://localhost/api/v1/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as { paths: Record<string, unknown> };
    expect(spec.paths["/api/v1/savings-rules"]).toBeDefined();
    expect(spec.paths["/api/v1/recurring-payments"]).toBeDefined();
    expect(spec.paths["/api/v1/recurring-payments/{id}/marks"]).toBeDefined();
  });

  it("supports PR 8 Goals, Goal Transfers, Debts CRUD, reference checks, and OpenAPI registration", async () => {
    const { app } = createTestHarness();

    // Uninvited user blocked with 403 INVITE_REQUIRED
    const uninvitedGoals = await app.request("http://localhost/api/v1/goals", {
      headers: { Authorization: "Bearer token-uninvited" },
    });
    expect(uninvitedGoals.status).toBe(403);
    expect(((await uninvitedGoals.json()) as { error: string }).error).toBe("INVITE_REQUIRED");

    const uninvitedDebts = await app.request("http://localhost/api/v1/debts", {
      headers: { Authorization: "Bearer token-uninvited" },
    });
    expect(uninvitedDebts.status).toBe(403);
    expect(((await uninvitedDebts.json()) as { error: string }).error).toBe("INVITE_REQUIRED");

    // Create savings account
    const accRes = await app.request("http://localhost/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Savings Pot",
        type: "savings",
        currency: "RUB",
        initial_balance_minor: 5000000,
      }),
    });
    const accId = ((await accRes.json()) as { account: { id: string } }).account.id;

    // Reject unknown storage_account_id
    const badGoalRef = await app.request("http://localhost/api/v1/goals", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Bad Goal",
        target_amount_minor: 100000,
        storage_account_id: "99999999-9999-4999-8999-999999999999",
      }),
    });
    expect(badGoalRef.status).toBe(400);
    expect(((await badGoalRef.json()) as { error: string }).error).toBe("INVALID_REFERENCE");

    // Create two goals
    const g1Res = await app.request("http://localhost/api/v1/goals", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Emergency Fund",
        priority: "high",
        target_amount_minor: 10000000,
        initial_amount_minor: 2000000,
        monthly_plan_minor: 1000000,
        storage_account_id: accId,
      }),
    });
    expect(g1Res.status).toBe(201);
    const goal1Id = ((await g1Res.json()) as { goal: { id: string } }).goal.id;

    const g2Res = await app.request("http://localhost/api/v1/goals", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Vacation",
        priority: "medium",
        target_amount_minor: 5000000,
        storage_account_id: accId,
      }),
    });
    expect(g2Res.status).toBe(201);
    const goal2Id = ((await g2Res.json()) as { goal: { id: string } }).goal.id;

    // Reject identical from_goal_id and to_goal_id
    const sameGoalTransfer = await app.request("http://localhost/api/v1/goal-transfers", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_goal_id: goal1Id,
        to_goal_id: goal1Id,
        amount_minor: 50000,
      }),
    });
    expect(sameGoalTransfer.status).toBe(400);

    // Create valid goal transfer
    const gtRes = await app.request("http://localhost/api/v1/goal-transfers", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_goal_id: goal1Id,
        to_goal_id: goal2Id,
        amount_minor: 500000,
        comment: "Reallocate to trip",
      }),
    });
    expect(gtRes.status).toBe(201);
    const transferId = ((await gtRes.json()) as { goal_transfer: { id: string } }).goal_transfer.id;

    // List goals returns both goals and transfer
    const listGoalsRes = await app.request("http://localhost/api/v1/goals", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(listGoalsRes.status).toBe(200);
    const listGoalsJson = (await listGoalsRes.json()) as {
      goals: unknown[];
      goal_transfers: unknown[];
    };
    expect(listGoalsJson.goals).toHaveLength(2);
    expect(listGoalsJson.goal_transfers).toHaveLength(1);

    // Patch & soft-delete goal transfer and goal
    const delGtRes = await app.request(
      `http://localhost/api/v1/goal-transfers/${transferId}`,
      {
        method: "DELETE",
        headers: { Authorization: "Bearer token-invited" },
      }
    );
    expect(delGtRes.status).toBe(200);

    const patchGoalRes = await app.request(`http://localhost/api/v1/goals/${goal2Id}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_archived: true }),
    });
    expect(patchGoalRes.status).toBe(200);

    const delGoalRes = await app.request(`http://localhost/api/v1/goals/${goal2Id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(delGoalRes.status).toBe(200);

    // Debts CRUD + merged amount invariant
    const createDebtRes = await app.request("http://localhost/api/v1/debts", {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction: "lent",
        counterparty: "Alex",
        amount_minor: 300000,
        manual_repaid_minor: 50000,
        opened_at: "2026-11-15",
        due_date: "2026-12-01",
        comment: "Tickets",
      }),
    });
    expect(createDebtRes.status).toBe(201);
    const debtId = ((await createDebtRes.json()) as { debt: { id: string } }).debt.id;

    const badPatchDebt = await app.request(`http://localhost/api/v1/debts/${debtId}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ manual_repaid_minor: 400000 }),
    });
    expect(badPatchDebt.status).toBe(400);
    expect(((await badPatchDebt.json()) as { error: string }).error).toBe("VALIDATION_ERROR");

    const okPatchDebt = await app.request(`http://localhost/api/v1/debts/${debtId}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token-invited",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ manual_repaid_minor: 300000 }),
    });
    expect(okPatchDebt.status).toBe(200);

    const listDebtsRes = await app.request("http://localhost/api/v1/debts?direction=lent", {
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(listDebtsRes.status).toBe(200);
    expect(((await listDebtsRes.json()) as { debts: unknown[] }).debts).toHaveLength(1);

    const delDebtRes = await app.request(`http://localhost/api/v1/debts/${debtId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer token-invited" },
    });
    expect(delDebtRes.status).toBe(200);

    // OpenAPI 3.1 exposes PR 8 routes
    const specRes = await app.request("http://localhost/api/v1/openapi.json");
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as { paths: Record<string, unknown> };
    expect(spec.paths["/api/v1/goals"]).toBeDefined();
    expect(spec.paths["/api/v1/goals/{id}"]).toBeDefined();
    expect(spec.paths["/api/v1/goal-transfers"]).toBeDefined();
    expect(spec.paths["/api/v1/goal-transfers/{id}"]).toBeDefined();
    expect(spec.paths["/api/v1/debts"]).toBeDefined();
    expect(spec.paths["/api/v1/debts/{id}"]).toBeDefined();
  });
});
