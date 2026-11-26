import type { MiddlewareHandler } from "hono";
import type { ApiDependencies, ApiEnv, ProfileGateState } from "../types";

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

    c.set("auth", auth);
    await next();
  };
}

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
  if (!auth) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required",
      },
      401
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
