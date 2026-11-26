import type { MiddlewareHandler } from "hono";
import type { ApiDependencies, ApiEnv, AuthSecurityState, ProfileGateState } from "../types";

function parseAuthStateRow(
  raw: unknown,
  fallbackSessionId: string | null,
  fallbackAal: "aal1" | "aal2" | null
): AuthSecurityState | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") {
    return null;
  }

  const record = row as Record<string, unknown>;
  return {
    session_active: Boolean(record.session_active),
    session_id: typeof record.session_id === "string" ? record.session_id : fallbackSessionId,
    current_aal: record.current_aal === "aal2" ? "aal2" : fallbackAal ?? "aal1",
    mfa_enrolled: Boolean(record.mfa_enrolled),
    mfa_required: Boolean(record.mfa_required),
  };
}

export function createRequireAuth(deps: ApiDependencies): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const auth = await deps.resolveAuth(c.req.raw);
    if (!auth) {
      return c.json(
        {
          error: "UNAUTHORIZED",
          message: "Valid cookie session or Bearer JWT is required",
        },
        401
      );
    }

    const { data, error } = await auth.supabase.rpc("get_my_auth_state");
    if (error) {
      return c.json(
        {
          error: "AUTH_STATE_LOOKUP_FAILED",
          message: error.message || "Failed to verify session state",
        },
        500
      );
    }

    const authState = parseAuthStateRow(data, auth.sessionId, auth.aal);
    if (!authState || !authState.session_active) {
      return c.json(
        {
          error: "SESSION_REVOKED",
          message: "Session has been revoked or expired",
        },
        401
      );
    }

    c.set("auth", auth);
    c.set("authState", authState);
    await next();
  };
}

export const requireMfaVerified: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = c.get("auth");
  const authState = c.get("authState");
  if (!auth || !authState) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required",
      },
      401
    );
  }

  if (authState.mfa_required) {
    return c.json(
      {
        error: "MFA_REQUIRED",
        message: "Two-factor authentication verification is required",
      },
      403
    );
  }

  await next();
};

export async function evaluateInviteGate(
  auth: NonNullable<ApiEnv["Variables"]["auth"]>
): Promise<{ ok: true; gate: ProfileGateState } | { ok: false; status: 403 | 500; error: string; message: string }> {
  const [flagRes, profileRes] = await Promise.all([
    auth.supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "registration_invite_only")
      .maybeSingle(),
    auth.supabase
      .from("profiles")
      .select("role, invite_redeemed_at")
      .eq("id", auth.userId)
      .maybeSingle(),
  ]);

  if (flagRes.error || profileRes.error) {
    return {
      ok: false,
      status: 500,
      error: "AUTH_PROFILE_LOOKUP_FAILED",
      message: flagRes.error?.message ?? profileRes.error?.message ?? "Failed to evaluate invite gate",
    };
  }

  const inviteOnlyEnabled = flagRes.data?.enabled ?? true;
  const role = profileRes.data?.role === "admin" ? "admin" : "user";
  const inviteRedeemedAt = profileRes.data?.invite_redeemed_at ?? null;
  const inviteRequired = inviteOnlyEnabled && role !== "admin" && inviteRedeemedAt === null;

  if (inviteRequired) {
    return {
      ok: false,
      status: 403,
      error: "INVITE_REQUIRED",
      message: "An invite code is required to access financial endpoints",
    };
  }

  return {
    ok: true,
    gate: {
      role,
      invite_redeemed_at: inviteRedeemedAt,
      invite_required: false,
    },
  };
}

export const requireInviteGate: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = c.get("auth");
  const authState = c.get("authState");
  if (!auth) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required",
      },
      401
    );
  }

  if (authState?.mfa_required) {
    return c.json(
      {
        error: "MFA_REQUIRED",
        message: "Two-factor authentication verification is required",
      },
      403
    );
  }

  const result = await evaluateInviteGate(auth);
  if (!result.ok) {
    return c.json(
      {
        error: result.error,
        message: result.message,
      },
      result.status
    );
  }

  c.set("profileGate", result.gate);
  await next();
};

export const requireAdmin: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = c.get("auth");
  if (!auth) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required",
      },
      401
    );
  }

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error) {
    return c.json(
      {
        error: "AUTH_PROFILE_LOOKUP_FAILED",
        message: error.message,
      },
      500
    );
  }

  if (profile?.role !== "admin") {
    return c.json(
      {
        error: "ADMIN_REQUIRED",
        message: "Administrator privileges required",
      },
      403
    );
  }

  await next();
};
