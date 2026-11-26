import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ErrorResponseSchema, FeatureFlagsResponseSchema } from "@strata/api-contract";
import type { ApiDependencies, ApiEnv } from "../types";

const listFeatureFlagsRoute = createRoute({
  method: "get",
  path: "/feature-flags",
  tags: ["System"],
  summary: "List active cloud feature flags",
  responses: {
    200: {
      description: "Feature flags visible to the caller",
      content: {
        "application/json": {
          schema: FeatureFlagsResponseSchema,
        },
      },
    },
    500: {
      description: "Database error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export function createFeatureFlagsRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();

  router.openapi(listFeatureFlagsRoute, async (c) => {
    const auth = await deps.resolveAuth(c.req.raw).catch(() => null);
    const client = auth?.supabase ?? deps.getPublicClient();

    if (!client) {
      return c.json(
        {
          flags: [],
          server_time: new Date().toISOString(),
        },
        200
      );
    }

    let isAdmin = false;
    if (auth) {
      const { data: profile } = await auth.supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.userId)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }

    const { data, error } = await client
      .from("feature_flags")
      .select("key, enabled, starts_at, ends_at, admin_preview, config, updated_at")
      .order("key", { ascending: true });

    if (error) {
      return c.json(
        {
          error: "FEATURE_FLAGS_LOAD_FAILED",
          message: error.message,
        },
        500
      );
    }

    const flags = (data ?? [])
      .filter((flag) => isAdmin || !(flag.admin_preview && !flag.enabled))
      .map((flag) => ({
        key: flag.key,
        enabled: flag.enabled,
        starts_at: flag.starts_at,
        ends_at: flag.ends_at,
        admin_preview: flag.admin_preview,
        config:
          flag.config && typeof flag.config === "object" && !Array.isArray(flag.config)
            ? (flag.config as Record<string, unknown>)
            : {},
        updated_at: flag.updated_at,
      }));

    return c.json(
      {
        flags,
        server_time: new Date().toISOString(),
      },
      200
    );
  });

  return router;
}
