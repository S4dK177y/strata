import { OpenAPIHono } from "@hono/zod-openapi";
import { createPublicSupabaseClient, resolveRequestAuth } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";
import { createAccountsRouter } from "./routes/accounts";
import { createAdminRouter } from "./routes/admin";
import { createCategoriesRouter } from "./routes/categories";
import { createDebtsRouter } from "./routes/debts";
import { createExportRouter } from "./routes/export";
import { createFeatureFlagsRouter } from "./routes/feature-flags";
import { createGoalsRouter } from "./routes/goals";
import { createHealthRouter } from "./routes/health";
import { createInvitesRouter } from "./routes/invites";
import { createMeRouter } from "./routes/me";
import { createOnboardingRouter } from "./routes/onboarding";
import { createRecurringPaymentsRouter } from "./routes/recurring-payments";
import { createSavingsRulesRouter } from "./routes/savings-rules";
import { createSecurityRouter } from "./routes/security";
import { createSyncRouter } from "./routes/sync";
import { createTransactionsRouter } from "./routes/transactions";
import type { ApiDependencies, ApiEnv } from "./types";

const defaultDeps: ApiDependencies = {
  resolveAuth: resolveRequestAuth,
  getPublicClient: createPublicSupabaseClient,
  getServiceClient: createServiceRoleSupabaseClient,
};

export function createApiApp(deps: ApiDependencies = defaultDeps) {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: result.error.issues,
          },
          400
        );
      }
      return undefined;
    },
  }).basePath("/api/v1");

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Supabase access token JWT for native Android & API clients",
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "sb-access-token",
    description: "Supabase SSR session cookie for Web PWA",
  });

  app.onError((err, c) => {
    console.error("[strata-api] unhandled error:", err);
    return c.json(
      {
        error: "INTERNAL_ERROR",
        message: "Internal server error",
      },
      500
    );
  });

  app.notFound((c) => {
    return c.json(
      {
        error: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404
    );
  });

  app.route("/", createHealthRouter(deps));
  app.route("/", createFeatureFlagsRouter(deps));
  app.route("/", createMeRouter(deps));
  app.route("/", createSecurityRouter(deps));
  app.route("/", createInvitesRouter(deps));
  app.route("/", createOnboardingRouter(deps));
  app.route("/", createAccountsRouter(deps));
  app.route("/", createCategoriesRouter(deps));
  app.route("/", createTransactionsRouter(deps));
  app.route("/", createSavingsRulesRouter(deps));
  app.route("/", createRecurringPaymentsRouter(deps));
  app.route("/", createGoalsRouter(deps));
  app.route("/", createDebtsRouter(deps));
  app.route("/", createSyncRouter(deps));
  app.route("/", createExportRouter(deps));
  app.route("/", createAdminRouter(deps));

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "Strata REST API",
      version: "0.1.0",
      description:
        "Privacy-first personal finance API shared by Strata Web PWA and native Android client. All money amounts use integer minor units (*_minor).",
    },
    servers: [{ url: "/", description: "Current host" }],
  });

  return app;
}

export const apiApp = createApiApp();
