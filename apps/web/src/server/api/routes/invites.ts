import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  RedeemInviteRequestSchema,
  RedeemInviteResponseSchema,
} from "@strata/api-contract";
import { createRequireAuth } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

const redeemInviteRoute = createRoute({
  method: "post",
  path: "/invites/redeem",
  tags: ["Auth & Invites"],
  summary: "Redeem an invite code for the authenticated user",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RedeemInviteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Invite code redeemed",
      content: {
        "application/json": {
          schema: RedeemInviteResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid, expired, or exhausted invite code",
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
    500: {
      description: "Failed to redeem invite code",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export function createInvitesRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/invites/*", requireAuth);

  router.openapi(redeemInviteRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const { data, error } = await auth.supabase.rpc("redeem_invite_code", {
      p_code: body.code,
    });

    if (error) {
      const msg = error.message ?? "";
      const isInvalidInvite =
        error.code === "P0001" ||
        msg.includes("INVALID_INVITE_CODE") ||
        msg.includes("INVALID_OR_EXPIRED_INVITE_CODE");

      if (isInvalidInvite) {
        return c.json(
          {
            error: "INVALID_OR_EXPIRED_INVITE_CODE",
            message: "Invite code is invalid, expired, or has already been used",
          },
          400
        );
      }

      return c.json(
        {
          error: "INVITE_REDEEM_FAILED",
          message: error.message,
        },
        500
      );
    }

    const redeemedAt =
      typeof data === "string" && data.length > 0 ? data : new Date().toISOString();

    return c.json(
      {
        invite_redeemed_at: redeemedAt,
        invite_required: false as const,
      },
      200
    );
  });

  return router;
}
