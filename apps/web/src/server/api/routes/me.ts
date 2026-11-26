import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  MeResponseSchema,
  ProfileUpdateRequestSchema,
  WrappedSettingsSchema,
} from "@strata/api-contract";
import { maybeBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import {
  computeInviteRequired,
  PROFILE_SELECT_COLUMNS,
  serializeProfileRow,
} from "@/lib/auth/profile-serializer";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireMfaVerified } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Profile"],
  summary: "Get current authenticated user profile & invite gate status",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "Authenticated user profile",
      content: {
        "application/json": {
          schema: MeResponseSchema,
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
    404: {
      description: "Profile not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to load profile",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const patchMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["Profile"],
  summary: "Update current user profile preferences (locale, theme, privacy blur, display name)",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ProfileUpdateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated user profile",
      content: {
        "application/json": {
          schema: MeResponseSchema,
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
      description: "MFA verification required",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Profile not found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to update profile",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export function createMeRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/me", requireAuth);
  router.use("/me", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      return requireMfaVerified(c, next);
    }
    await next();
  });

  router.openapi(getMeRoute, async (c) => {
    const auth = c.get("auth");
    const authState = c.get("authState");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const [profileRes, flagRes] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", auth.userId)
        .maybeSingle(),
      auth.supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "registration_invite_only")
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      return c.json(
        { error: "PROFILE_LOAD_FAILED", message: profileRes.error.message },
        500
      );
    }

    const row = profileRes.data;
    if (!row) {
      return c.json(
        { error: "PROFILE_NOT_FOUND", message: "User profile does not exist" },
        404
      );
    }

    let profile = serializeProfileRow(row);
    if (profile.role !== "admin") {
      const promoted = await maybeBootstrapAdmin({ userId: auth.userId, email: auth.email });
      if (promoted) {
        profile = { ...profile, role: "admin" };
      }
    }
    const inviteOnlyEnabled = flagRes.data?.enabled ?? true;
    const inviteRequired = computeInviteRequired(inviteOnlyEnabled, profile);

    return c.json(
      {
        profile,
        email: auth.email,
        invite_required: inviteRequired,
        aal: authState?.current_aal ?? "aal1",
        mfa_enabled: authState?.mfa_enrolled ?? false,
        mfa_required: authState?.mfa_required ?? false,
      },
      200
    );
  });

  router.openapi(patchMeRoute, async (c) => {
    const auth = c.get("auth");
    const authState = c.get("authState");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const updatePatch: Database["public"]["Tables"]["profiles"]["Update"] = {};

    if (body.display_name !== undefined) updatePatch.display_name = body.display_name;
    if (body.locale !== undefined) updatePatch.locale = body.locale;
    if (body.base_currency !== undefined) updatePatch.base_currency = body.base_currency;
    if (body.theme !== undefined) updatePatch.theme = body.theme;
    if (body.privacy_blur_default !== undefined) {
      updatePatch.privacy_blur_default = body.privacy_blur_default;
    }
    if (body.onboarding_completed !== undefined) {
      updatePatch.onboarding_completed = body.onboarding_completed;
    }

    if (body.wrapped_settings !== undefined) {
      const { data: existingRow, error: fetchError } = await auth.supabase
        .from("profiles")
        .select("wrapped_settings")
        .eq("id", auth.userId)
        .maybeSingle();

      if (fetchError) {
        return c.json(
          { error: "PROFILE_LOAD_FAILED", message: fetchError.message },
          500
        );
      }

      if (!existingRow) {
        return c.json(
          { error: "PROFILE_NOT_FOUND", message: "User profile does not exist" },
          404
        );
      }

      const existingWrapped = WrappedSettingsSchema.safeParse(
        existingRow.wrapped_settings ?? {}
      );
      const baseWrapped = existingWrapped.success
        ? existingWrapped.data
        : WrappedSettingsSchema.parse({});

      updatePatch.wrapped_settings = WrappedSettingsSchema.parse({
        ...baseWrapped,
        ...body.wrapped_settings,
      });
    }

    const [updateRes, flagRes] = await Promise.all([
      auth.supabase
        .from("profiles")
        .update(updatePatch)
        .eq("id", auth.userId)
        .select(PROFILE_SELECT_COLUMNS)
        .maybeSingle(),
      auth.supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "registration_invite_only")
        .maybeSingle(),
    ]);

    if (updateRes.error) {
      return c.json(
        { error: "PROFILE_UPDATE_FAILED", message: updateRes.error.message },
        500
      );
    }

    if (!updateRes.data) {
      return c.json(
        { error: "PROFILE_NOT_FOUND", message: "User profile does not exist" },
        404
      );
    }

    const profile = serializeProfileRow(updateRes.data);
    const inviteOnlyEnabled = flagRes.data?.enabled ?? true;
    const inviteRequired = computeInviteRequired(inviteOnlyEnabled, profile);

    return c.json(
      {
        profile,
        email: auth.email,
        invite_required: inviteRequired,
        aal: authState?.current_aal ?? "aal1",
        mfa_enabled: authState?.mfa_enrolled ?? false,
        mfa_required: authState?.mfa_required ?? false,
      },
      200
    );
  });

  return router;
}
