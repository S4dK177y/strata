import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HealthResponseSchema } from "@strata/api-contract";
import type { ApiDependencies, ApiEnv } from "../types";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Healthcheck & lightweight DB keepalive ping",
  responses: {
    200: {
      description: "Service health status",
      content: {
        "application/json": {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

export function createHealthRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();

  router.openapi(healthRoute, async (c) => {
    let db: "ok" | "unconfigured" | "error" = "unconfigured";

    const supabase = deps.getPublicClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("feature_flags").select("key").limit(1);
        db = error ? "error" : "ok";
      } catch {
        db = "error";
      }
    }

    return c.json(
      {
        status: "ok" as const,
        app: "strata" as const,
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        db,
      },
      200
    );
  });

  return router;
}
