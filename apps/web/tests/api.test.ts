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
        is_active: true,
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        code: "EXPIRED-CODE",
        max_uses: 1,
        used_count: 1,
        expires_at: null,
        is_active: true,
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
  private mode: "select" | "update" | "upsert" | "insert" = "select";
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

  private execute(): { rows: RowRecord[]; totalCount: number | null } {
    const rows = this.state[this.table];

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
      return { rows: updated, totalCount: updated.length };
    }

    if (this.mode === "upsert" && this.mutationPayload) {
      this.onWrite?.(this.table, "upsert");
      const now = new Date().toISOString();
      const idx = rows.findIndex((r) => r.id === this.mutationPayload?.id);
      if (idx >= 0) {
        const nextRow = { ...rows[idx], ...this.mutationPayload, updated_at: now };
        rows[idx] = nextRow;
        return { rows: [{ ...nextRow }], totalCount: 1 };
      }
      const inserted = { ...this.mutationPayload, updated_at: now };
      rows.push(inserted);
      return { rows: [{ ...inserted }], totalCount: 1 };
    }

    if (this.mode === "insert") {
      this.onWrite?.(this.table, "insert");
      const now = new Date().toISOString();
      const inserted = this.insertRows.map((row, idx) => ({
        id: row.id ?? `00000000-0000-4000-8000-${String(rows.length + idx + 1).padStart(12, "0")}`,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        ...row,
      }));
      rows.push(...inserted);
      return { rows: inserted.map((r) => ({ ...r })), totalCount: inserted.length };
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
    return { rows: result.map((r) => ({ ...r })), totalCount };
  }

  async maybeSingle() {
    const { rows } = this.execute();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const { rows } = this.execute();
    if (!rows[0]) {
      return { data: null, error: { message: "Row not found" } };
    }
    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: RowRecord[]; error: null; count: number | null }>(
    onfulfilled?: (value: {
      data: RowRecord[];
      error: null;
      count: number | null;
    }) => TResult1 | PromiseLike<TResult1>
  ) {
    const { rows, totalCount } = this.execute();
    const res = {
      data: rows,
      error: null as null,
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
            Number(i.used_count) < Number(i.max_uses)
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
        };
      }
      if (auth === "Bearer token-uninvited") {
        const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        return {
          supabase: createMockClient(state, onWrite, userId),
          userId,
          email: "uninvited@strata.app",
          authMode: "bearer",
        };
      }
      if (auth === "Bearer token-admin") {
        const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
        return {
          supabase: createMockClient(state, onWrite, userId),
          userId,
          email: "admin@strata.app",
          authMode: "bearer",
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
});
