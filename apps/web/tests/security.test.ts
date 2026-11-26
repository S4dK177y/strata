import { describe, expect, it } from "vitest";
import { parseSessionUserAgent } from "@/lib/security/user-agent";
import type { AppSupabaseClient, RequestAuthContext } from "@/lib/supabase/server";
import { createApiApp } from "@/server/api/app";
import type { ApiDependencies } from "@/server/api/types";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SESSION_1 = "11111111-1111-4111-8111-111111111111";
const SESSION_2 = "22222222-2222-4222-8222-222222222222";
const FACTOR_ID = "33333333-3333-4333-8333-333333333333";

interface SecurityHarnessOptions {
  userId?: string;
  role?: "user" | "admin";
  adminCount?: number;
  sessionActive?: boolean;
  mfaEnrolled?: boolean;
  currentAal?: "aal1" | "aal2";
  validPassword?: string;
  validTotp?: string;
}

function createSecurityHarness(opts: SecurityHarnessOptions = {}) {
  const userId = opts.userId ?? USER_ID;
  const role = opts.role ?? "user";
  const adminCount = opts.adminCount ?? (role === "admin" ? 1 : 0);
  const sessionActive = opts.sessionActive ?? true;
  const mfaEnrolled = opts.mfaEnrolled ?? false;
  const currentAal = opts.currentAal ?? "aal1";
  const mfaRequired = sessionActive && mfaEnrolled && currentAal !== "aal2";
  const validPassword = opts.validPassword ?? "correct-password";
  const validTotp = opts.validTotp ?? "654321";

  const callLog: string[] = [];
  const sessions = [
    {
      id: SESSION_1,
      created_at: "2026-11-26T10:00:00.000Z",
      updated_at: "2026-11-26T12:00:00.000Z",
      refreshed_at: "2026-11-26T12:30:00.000Z",
      not_after: null,
      aal: currentAal,
      user_agent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ip: "203.0.113.10",
      is_current: true,
    },
    {
      id: SESSION_2,
      created_at: "2026-11-25T08:00:00.000Z",
      updated_at: "2026-11-25T09:00:00.000Z",
      refreshed_at: null,
      not_after: null,
      aal: "aal1",
      user_agent: "StrataAndroid/1.0 (Android 14; Pixel 8)",
      ip: "198.51.100.24",
      is_current: false,
    },
  ];

  const now = "2026-11-26T04:00:00.000Z";
  const profileRow = {
    id: userId,
    role,
    display_name: "Security Tester",
    locale: "ru",
    base_currency: "RUB",
    theme: "dark",
    privacy_blur_default: false,
    onboarding_completed: true,
    invite_redeemed_at: now,
    wrapped_settings: {},
    created_at: now,
    updated_at: now,
  };

  function makeQueryStub(table: string) {
    let headCount = false;
    return {
      select(_cols?: string, selectOpts?: { count?: "exact"; head?: boolean }) {
        headCount = Boolean(selectOpts?.head);
        return this;
      },
      eq() {
        return this;
      },
      is() {
        return this;
      },
      order() {
        return this;
      },
      async maybeSingle() {
        if (table === "profiles") {
          return { data: profileRow, error: null };
        }
        if (table === "feature_flags") {
          return { data: { enabled: true }, error: null };
        }
        return { data: null, error: null };
      },
      then<TResult>(onfulfilled?: (v: { data: unknown; error: null; count: number | null }) => TResult) {
        const res = {
          data: headCount ? null : table === "accounts" ? [] : [profileRow],
          error: null as null,
          count: table === "profiles" ? adminCount : 0,
        };
        return Promise.resolve(res).then(onfulfilled);
      },
    };
  }

  const userSupabase = {
    from(table: string) {
      return makeQueryStub(table);
    },
    async rpc(fnName: string, args?: Record<string, unknown>) {
      if (fnName === "get_my_auth_state") {
        return {
          data: [
            {
              session_active: sessionActive,
              session_id: SESSION_1,
              current_aal: currentAal,
              mfa_enrolled: mfaEnrolled,
              mfa_required: mfaRequired,
            },
          ],
          error: null,
        };
      }
      if (fnName === "get_my_sessions") {
        return { data: sessions, error: null };
      }
      if (fnName === "revoke_my_session") {
        const targetId = String(args?.p_session_id ?? "");
        const idx = sessions.findIndex((s) => s.id === targetId);
        if (idx < 0) return { data: false, error: null };
        sessions.splice(idx, 1);
        callLog.push(`rpc:revoke_my_session:${targetId}`);
        return { data: true, error: null };
      }
      if (fnName === "revoke_other_sessions") {
        const removed = sessions.filter((s) => !s.is_current).length;
        callLog.push(`rpc:revoke_other_sessions:${removed}`);
        return { data: removed, error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
    auth: {
      async signOut(params?: { scope?: string }) {
        callLog.push(`user:signOut:${params?.scope ?? "default"}`);
        return { error: null };
      },
    },
  } as unknown as AppSupabaseClient;

  const verifyClient = {
    auth: {
      async signInWithPassword(creds: { email: string; password: string }) {
        callLog.push("verify:signInWithPassword");
        if (creds.password !== validPassword) {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        }
        return { data: { user: { id: userId, email: creds.email }, session: {} }, error: null };
      },
      mfa: {
        async challengeAndVerify(params: { factorId: string; code: string }) {
          callLog.push(`verify:mfa:${params.factorId}`);
          if (params.code !== validTotp) {
            return { data: null, error: { message: "Invalid TOTP code" } };
          }
          return { data: { access_token: "aal2-token" }, error: null };
        },
      },
      async signOut(params?: { scope?: string }) {
        callLog.push(`verify:signOut:${params?.scope ?? "default"}`);
        return { error: null };
      },
    },
  } as unknown as AppSupabaseClient;

  const serviceClient = {
    from(table: string) {
      return makeQueryStub(table);
    },
    auth: {
      admin: {
        async getUserById(id: string) {
          callLog.push(`admin:getUserById:${id}`);
          return {
            data: {
              user: {
                id,
                email: "security@strata.app",
                factors: mfaEnrolled
                  ? [{ id: FACTOR_ID, factor_type: "totp", status: "verified" }]
                  : [],
              },
            },
            error: null,
          };
        },
        async deleteUser(id: string, shouldSoftDelete?: boolean) {
          callLog.push(`admin:deleteUser:${id}:soft=${String(shouldSoftDelete)}`);
          return { data: { user: null }, error: null };
        },
      },
    },
  } as unknown as AppSupabaseClient;

  const deps: ApiDependencies = {
    getPublicClient: () => verifyClient,
    getServiceClient: () => serviceClient,
    resolveAuth: async (request: Request): Promise<RequestAuthContext | null> => {
      if (request.headers.get("authorization") !== "Bearer test-token") return null;
      return {
        supabase: userSupabase,
        userId,
        email: "security@strata.app",
        authMode: "bearer",
        sessionId: SESSION_1,
        aal: currentAal,
      };
    },
  };

  return { app: createApiApp(deps), callLog, sessions };
}

describe("PR 5 Account Security & Session Control", () => {
  it("parses desktop, mobile, tablet, StrataAndroid, OkHttp, and empty User-Agents", () => {
    const linuxChrome = parseSessionUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    expect(linuxChrome.device_type).toBe("desktop");
    expect(linuxChrome.device_label).toBe("Chrome 131 · Linux");

    const iosSafari = parseSessionUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
    );
    expect(iosSafari.device_type).toBe("mobile");
    expect(iosSafari.os).toBe("iOS 18.1");

    const ipad = parseSessionUserAgent(
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    );
    expect(ipad.device_type).toBe("tablet");

    const strataAndroid = parseSessionUserAgent("StrataAndroid/1.0 (Android 14; Pixel 8)");
    expect(strataAndroid).toEqual({
      device_type: "mobile",
      device_label: "Strata Android 1.0 · Android 14",
      browser: "Strata Android 1.0",
      os: "Android 14",
    });

    const okhttp = parseSessionUserAgent("okhttp/4.12.0");
    expect(okhttp.device_type).toBe("mobile");
    expect(okhttp.device_label).toBe("Android App");

    const emptyUa = parseSessionUserAgent(null);
    expect(emptyUa.device_type).toBe("unknown");
    expect(emptyUa.device_label).toBe("Unknown device");
  });

  it("rejects revoked sessions immediately with 401 SESSION_REVOKED", async () => {
    const { app } = createSecurityHarness({ sessionActive: false });
    const headers = { Authorization: "Bearer test-token" };

    const meRes = await app.request("http://localhost/api/v1/me", { headers });
    expect(meRes.status).toBe(401);
    const body = (await meRes.json()) as { error: string };
    expect(body.error).toBe("SESSION_REVOKED");

    const sessionsRes = await app.request("http://localhost/api/v1/security/sessions", { headers });
    expect(sessionsRes.status).toBe(401);
  });

  it("enforces opt-in AAL2 across API routes while keeping GET /me accessible", async () => {
    const { app } = createSecurityHarness({ mfaEnrolled: true, currentAal: "aal1" });
    const headers = { Authorization: "Bearer test-token" };

    const meRes = await app.request("http://localhost/api/v1/me", { headers });
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as {
      aal: string;
      mfa_enabled: boolean;
      mfa_required: boolean;
    };
    expect(meJson.aal).toBe("aal1");
    expect(meJson.mfa_enabled).toBe(true);
    expect(meJson.mfa_required).toBe(true);

    const patchMeRes = await app.request("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Blocked" }),
    });
    expect(patchMeRes.status).toBe(403);
    expect(((await patchMeRes.json()) as { error: string }).error).toBe("MFA_REQUIRED");

    const accountsRes = await app.request("http://localhost/api/v1/accounts", { headers });
    expect(accountsRes.status).toBe(403);

    const sessionsRes = await app.request("http://localhost/api/v1/security/sessions", { headers });
    expect(sessionsRes.status).toBe(403);
  });

  it("lists active sessions and revokes individual, current, and other sessions", async () => {
    const { app, callLog } = createSecurityHarness({ mfaEnrolled: true, currentAal: "aal2" });
    const headers = { Authorization: "Bearer test-token" };

    const listRes = await app.request("http://localhost/api/v1/security/sessions", { headers });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      current_session_id: string;
      sessions: Array<{ id: string; is_current: boolean; device_label: string; ip: string }>;
    };
    expect(listJson.current_session_id).toBe(SESSION_1);
    expect(listJson.sessions).toHaveLength(2);
    expect(listJson.sessions[0]?.device_label).toBe("Chrome 131 · Linux");
    expect(listJson.sessions[1]?.device_label).toBe("Strata Android 1.0 · Android 14");

    const notFoundRes = await app.request(
      "http://localhost/api/v1/security/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { method: "DELETE", headers }
    );
    expect(notFoundRes.status).toBe(404);

    const revokeOtherRes = await app.request(
      `http://localhost/api/v1/security/sessions/${SESSION_2}`,
      { method: "DELETE", headers }
    );
    expect(revokeOtherRes.status).toBe(200);
    expect(await revokeOtherRes.json()).toEqual({
      revoked: true,
      session_id: SESSION_2,
      signed_out_current: false,
    });

    const revokeCurrentRes = await app.request(
      `http://localhost/api/v1/security/sessions/${SESSION_1}`,
      { method: "DELETE", headers }
    );
    expect(revokeCurrentRes.status).toBe(200);
    expect(await revokeCurrentRes.json()).toEqual({
      revoked: true,
      session_id: SESSION_1,
      signed_out_current: true,
    });
    expect(callLog).toContain("user:signOut:local");

    const revokeOthersHarness = createSecurityHarness();
    const bulkRes = await revokeOthersHarness.app.request(
      "http://localhost/api/v1/security/sessions/revoke-others",
      { method: "POST", headers }
    );
    expect(bulkRes.status).toBe(200);
    expect(await bulkRes.json()).toEqual({ revoked_count: 1 });
  });

  it("validates password, TOTP code, last-admin guard, and cleanup order on account deletion", async () => {
    const headers = {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    };

    // 1) Last admin cannot self-delete
    const adminHarness = createSecurityHarness({
      userId: ADMIN_ID,
      role: "admin",
      adminCount: 1,
    });
    const lastAdminRes = await adminHarness.app.request(
      "http://localhost/api/v1/security/delete-account",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "correct-password" }),
      }
    );
    expect(lastAdminRes.status).toBe(409);
    expect(((await lastAdminRes.json()) as { error: string }).error).toBe(
      "LAST_ADMIN_CANNOT_DELETE"
    );

    // 2) Wrong password -> 403 INVALID_PASSWORD
    const wrongPassHarness = createSecurityHarness();
    const wrongPassRes = await wrongPassHarness.app.request(
      "http://localhost/api/v1/security/delete-account",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "wrong-password" }),
      }
    );
    expect(wrongPassRes.status).toBe(403);
    expect(((await wrongPassRes.json()) as { error: string }).error).toBe("INVALID_PASSWORD");
    expect(wrongPassHarness.callLog).not.toContain(`admin:deleteUser:${USER_ID}:soft=false`);

    // 3) Missing TOTP when MFA enabled -> 400 MFA_CODE_REQUIRED + ephemeral signOut still runs
    const missingTotpHarness = createSecurityHarness({
      mfaEnrolled: true,
      currentAal: "aal2",
    });
    const missingTotpRes = await missingTotpHarness.app.request(
      "http://localhost/api/v1/security/delete-account",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "correct-password" }),
      }
    );
    expect(missingTotpRes.status).toBe(400);
    expect(((await missingTotpRes.json()) as { error: string }).error).toBe("MFA_CODE_REQUIRED");
    expect(missingTotpHarness.callLog).toContain("verify:signOut:local");

    // 4) Wrong TOTP when MFA enabled -> 403 INVALID_MFA_CODE + ephemeral signOut still runs
    const wrongTotpHarness = createSecurityHarness({
      mfaEnrolled: true,
      currentAal: "aal2",
    });
    const wrongTotpRes = await wrongTotpHarness.app.request(
      "http://localhost/api/v1/security/delete-account",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "correct-password", totp_code: "000000" }),
      }
    );
    expect(wrongTotpRes.status).toBe(403);
    expect(((await wrongTotpRes.json()) as { error: string }).error).toBe("INVALID_MFA_CODE");
    expect(wrongTotpHarness.callLog).toContain("verify:signOut:local");

    // 5) Full valid deletion with MFA verifies strict call sequence
    const successHarness = createSecurityHarness({
      mfaEnrolled: true,
      currentAal: "aal2",
    });
    const successRes = await successHarness.app.request(
      "http://localhost/api/v1/security/delete-account",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "correct-password", totp_code: "654321" }),
      }
    );
    expect(successRes.status).toBe(200);
    expect(await successRes.json()).toEqual({ deleted: true });
    expect(successHarness.callLog).toEqual([
      `admin:getUserById:${USER_ID}`,
      "verify:signInWithPassword",
      `verify:mfa:${FACTOR_ID}`,
      "verify:signOut:local",
      "user:signOut:global",
      `admin:deleteUser:${USER_ID}:soft=false`,
    ]);
  });
});
