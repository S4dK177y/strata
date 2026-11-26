import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponseSchema, MeResponseSchema, WrappedSettingsSchema } from "@strata/api-contract";
import { createRequireAuth } from "../middleware/auth";
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

export function createMeRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/me", requireAuth);

  router.openapi(getMeRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const [profileRes, flagRes] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select(
          "id, role, display_name, locale, base_currency, theme, privacy_blur_default, onboarding_completed, invite_redeemed_at, wrapped_settings, created_at, updated_at"
        )
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

    const inviteOnlyEnabled = flagRes.data?.enabled ?? true;
    const role: "admin" | "user" = row.role === "admin" ? "admin" : "user";
    const theme: "light" | "dark" | "system" =
      row.theme === "light" || row.theme === "dark" ? row.theme : "system";
    const inviteRequired = inviteOnlyEnabled && role !== "admin" && row.invite_redeemed_at === null;
    const wrappedParsed = WrappedSettingsSchema.safeParse(row.wrapped_settings ?? {});

    return c.json(
      {
        profile: {
          id: row.id,
          role,
          display_name: row.display_name,
          locale: row.locale === "en" ? ("en" as const) : ("ru" as const),
          base_currency: row.base_currency,
          theme,
          privacy_blur_default: row.privacy_blur_default,
          onboarding_completed: row.onboarding_completed,
          invite_redeemed_at: row.invite_redeemed_at,
          wrapped_settings: wrappedParsed.success
            ? wrappedParsed.data
            : WrappedSettingsSchema.parse({}),
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
        email: auth.email,
        invite_required: inviteRequired,
      },
      200
    );
  });

  return router;
}
