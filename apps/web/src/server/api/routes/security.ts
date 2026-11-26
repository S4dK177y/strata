import { createRoute } from "@hono/zod-openapi";
import {
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
  ErrorResponseSchema,
  RevokeOtherSessionsResponseSchema,
  RevokeSessionResponseSchema,
  SessionListResponseSchema,
  z,
} from "@strata/api-contract";
import { parseSessionUserAgent } from "@/lib/security/user-agent";
import { createRequireAuth, requireMfaVerified } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

const SessionIdParamsSchema = z.object({
  id: z.uuid(),
});

const listSessionsRoute = createRoute({
  method: "get",
  path: "/security/sessions",
  tags: ["Security"],
  summary: "List active authentication sessions for the current user",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "Active sessions with parsed device metadata",
      content: { "application/json": { schema: SessionListResponseSchema } },
    },
    401: {
      description: "Unauthorized or revoked session",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "MFA verification required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to load sessions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const revokeSessionRoute = createRoute({
  method: "delete",
  path: "/security/sessions/{id}",
  tags: ["Security"],
  summary: "Revoke a specific active session by ID",
  security: AUTH_SECURITY,
  request: {
    params: SessionIdParamsSchema,
  },
  responses: {
    200: {
      description: "Session revoked",
      content: { "application/json": { schema: RevokeSessionResponseSchema } },
    },
    400: {
      description: "Invalid session ID",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized or revoked session",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "MFA verification required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Session not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to revoke session",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const revokeOtherSessionsRoute = createRoute({
  method: "post",
  path: "/security/sessions/revoke-others",
  tags: ["Security"],
  summary: "Revoke all active sessions except the current one",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "Other sessions revoked",
      content: { "application/json": { schema: RevokeOtherSessionsResponseSchema } },
    },
    401: {
      description: "Unauthorized or revoked session",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "MFA verification required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to revoke sessions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteAccountRoute = createRoute({
  method: "post",
  path: "/security/delete-account",
  tags: ["Security"],
  summary: "Permanently delete the authenticated user account and all financial data",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: DeleteAccountRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Account permanently deleted",
      content: { "application/json": { schema: DeleteAccountResponseSchema } },
    },
    400: {
      description: "Missing MFA code or validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized or revoked session",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "MFA required, invalid password, or invalid TOTP code",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Cannot delete the last remaining administrator",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    503: {
      description: "Account deletion service unavailable",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createSecurityRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/security/*", requireAuth, requireMfaVerified);

  router.openapi(listSessionsRoute, async (c) => {
    const auth = c.get("auth");
    const authState = c.get("authState");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase.rpc("get_my_sessions");
    if (error) {
      return c.json(
        {
          error: "SESSIONS_LOAD_FAILED",
          message: error.message || "Failed to load active sessions",
        },
        500
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const sessions = rows.map((row) => {
      const ua = parseSessionUserAgent(row.user_agent);
      const aal = row.aal === "aal2" ? ("aal2" as const) : row.aal === "aal1" ? ("aal1" as const) : null;
      return {
        id: row.id,
        is_current: Boolean(row.is_current),
        device_type: ua.device_type,
        device_label: ua.device_label,
        browser: ua.browser,
        os: ua.os,
        ip: row.ip ?? null,
        aal,
        created_at: row.created_at,
        last_active_at: row.refreshed_at ?? row.updated_at ?? row.created_at,
        not_after: row.not_after ?? null,
      };
    });

    return c.json(
      {
        sessions,
        current_session_id: authState?.session_id ?? auth.sessionId ?? null,
      },
      200
    );
  });

  router.openapi(revokeSessionRoute, async (c) => {
    const auth = c.get("auth");
    const authState = c.get("authState");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const { data, error } = await auth.supabase.rpc("revoke_my_session", {
      p_session_id: id,
    });

    if (error) {
      return c.json(
        {
          error: "SESSION_REVOKE_FAILED",
          message: error.message || "Failed to revoke session",
        },
        500
      );
    }

    if (!data) {
      return c.json(
        {
          error: "SESSION_NOT_FOUND",
          message: "Active session not found",
        },
        404
      );
    }

    const currentSessionId = authState?.session_id ?? auth.sessionId;
    const isCurrent = Boolean(currentSessionId && currentSessionId === id);
    if (isCurrent) {
      await auth.supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }

    return c.json(
      {
        revoked: true as const,
        session_id: id,
        signed_out_current: isCurrent,
      },
      200
    );
  });

  router.openapi(revokeOtherSessionsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase.rpc("revoke_other_sessions");
    if (error) {
      return c.json(
        {
          error: "SESSIONS_REVOKE_FAILED",
          message: error.message || "Failed to revoke other sessions",
        },
        500
      );
    }

    return c.json(
      {
        revoked_count: typeof data === "number" ? data : Number(data ?? 0),
      },
      200
    );
  });

  router.openapi(deleteAccountRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const serviceClient = deps.getServiceClient?.() ?? null;
    if (!serviceClient) {
      return c.json(
        {
          error: "SERVICE_UNAVAILABLE",
          message: "Account deletion is not configured on this server",
        },
        503
      );
    }

    const body = c.req.valid("json");

    const { data: profileRow, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", auth.userId)
      .maybeSingle();

    if (profileError) {
      return c.json(
        {
          error: "ACCOUNT_LOOKUP_FAILED",
          message: profileError.message,
        },
        500
      );
    }

    if (profileRow?.role === "admin") {
      const { count: adminCount, error: adminCountError } = await serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (adminCountError) {
        return c.json(
          {
            error: "ACCOUNT_LOOKUP_FAILED",
            message: adminCountError.message,
          },
          500
        );
      }

      if ((adminCount ?? 0) <= 1) {
        return c.json(
          {
            error: "LAST_ADMIN_CANNOT_DELETE",
            message: "Cannot delete the last remaining administrator account",
          },
          409
        );
      }
    }

    const { data: userLookup, error: userLookupError } =
      await serviceClient.auth.admin.getUserById(auth.userId);

    if (userLookupError || !userLookup.user) {
      return c.json(
        {
          error: "ACCOUNT_LOOKUP_FAILED",
          message: userLookupError?.message ?? "Unable to locate user account",
        },
        500
      );
    }

    const userEmail = userLookup.user.email?.trim() || auth.email?.trim() || null;
    if (!userEmail) {
      return c.json(
        {
          error: "ACCOUNT_EMAIL_MISSING",
          message: "Account has no email address for password verification",
        },
        400
      );
    }

    const verifyClient = deps.getPublicClient();
    if (!verifyClient) {
      return c.json(
        {
          error: "SERVICE_UNAVAILABLE",
          message: "Auth client is not configured",
        },
        503
      );
    }

    const { data: signInData, error: signInError } = await verifyClient.auth.signInWithPassword({
      email: userEmail,
      password: body.password,
    });

    if (signInError || !signInData.user || signInData.user.id !== auth.userId) {
      return c.json(
        {
          error: "INVALID_PASSWORD",
          message: "Current password is incorrect",
        },
        403
      );
    }

    try {
      const verifiedTotpFactors = (userLookup.user.factors ?? []).filter(
        (factor) => factor.factor_type === "totp" && factor.status === "verified"
      );

      if (verifiedTotpFactors.length > 0) {
        if (!body.totp_code) {
          return c.json(
            {
              error: "MFA_CODE_REQUIRED",
              message: "A 6-digit authenticator code is required to delete this account",
            },
            400
          );
        }

        let mfaVerified = false;
        for (const factor of verifiedTotpFactors) {
          const { error: mfaError } = await verifyClient.auth.mfa.challengeAndVerify({
            factorId: factor.id,
            code: body.totp_code,
          });
          if (!mfaError) {
            mfaVerified = true;
            break;
          }
        }

        if (!mfaVerified) {
          return c.json(
            {
              error: "INVALID_MFA_CODE",
              message: "Invalid authenticator verification code",
            },
            403
          );
        }
      }
    } finally {
      await verifyClient.auth.signOut({ scope: "local" }).catch(() => {});
    }

    await auth.supabase.auth.signOut({ scope: "global" }).catch(() => {});

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(auth.userId, false);
    if (deleteError) {
      return c.json(
        {
          error: "ACCOUNT_DELETE_FAILED",
          message: deleteError.message || "Failed to delete user account",
        },
        500
      );
    }

    return c.json({ deleted: true as const }, 200);
  });

  return router;
}
