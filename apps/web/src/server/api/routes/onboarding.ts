import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  OnboardingCompleteRequestSchema,
  OnboardingCompleteResponseSchema,
} from "@strata/api-contract";
import { PROFILE_SELECT_COLUMNS, serializeProfileRow } from "@/lib/auth/profile-serializer";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

const completeOnboardingRoute = createRoute({
  method: "post",
  path: "/onboarding/complete",
  tags: ["Onboarding"],
  summary: "Complete 3-step onboarding (profile preferences, starter accounts & categories)",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: OnboardingCompleteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Onboarding completed",
      content: {
        "application/json": {
          schema: OnboardingCompleteResponseSchema,
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
      description: "Invite code required",
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
      description: "Failed to complete onboarding",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export function createOnboardingRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/onboarding/*", requireAuth, requireInviteGate);

  router.openapi(completeOnboardingRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");

    let createdAccountsCount = 0;
    if (body.accounts.length > 0) {
      const accountRows: Array<Database["public"]["Tables"]["accounts"]["Insert"]> =
        body.accounts.map((acc, index) => ({
          user_id: auth.userId,
          name: acc.name,
          type: acc.type,
          currency: acc.currency,
          initial_balance_minor: acc.initial_balance_minor,
          credit_limit_minor: acc.credit_limit_minor,
          bank_name: acc.bank_name ?? null,
          last4_digits: acc.last4_digits ?? null,
          is_active: true,
          sort_order: index,
        }));

      const { error: accountsError } = await auth.supabase
        .from("accounts")
        .insert(accountRows);

      if (accountsError) {
        return c.json(
          { error: "ONBOARDING_ACCOUNTS_FAILED", message: accountsError.message },
          500
        );
      }
      createdAccountsCount = accountRows.length;
    }

    let createdCategoriesCount = 0;
    if (body.categories.length > 0) {
      const categoryRows: Array<Database["public"]["Tables"]["categories"]["Insert"]> =
        body.categories.map((cat, index) => ({
          user_id: auth.userId,
          name: cat.name,
          kind: cat.kind,
          is_passive: cat.is_passive,
          monthly_limit_minor: cat.monthly_limit_minor ?? null,
          icon: cat.icon ?? null,
          color: cat.color ?? null,
          sort_order: index,
        }));

      const { error: categoriesError } = await auth.supabase
        .from("categories")
        .insert(categoryRows);

      if (categoriesError) {
        return c.json(
          { error: "ONBOARDING_CATEGORIES_FAILED", message: categoriesError.message },
          500
        );
      }
      createdCategoriesCount = categoryRows.length;
    }

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      locale: body.locale,
      base_currency: body.base_currency,
      theme: body.theme,
      privacy_blur_default: body.privacy_blur_default,
      onboarding_completed: true,
    };
    if (body.display_name !== undefined) {
      profileUpdate.display_name = body.display_name;
    }

    const { data: updatedProfile, error: profileError } = await auth.supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", auth.userId)
      .select(PROFILE_SELECT_COLUMNS)
      .maybeSingle();

    if (profileError) {
      return c.json(
        { error: "ONBOARDING_PROFILE_FAILED", message: profileError.message },
        500
      );
    }

    if (!updatedProfile) {
      return c.json(
        { error: "PROFILE_NOT_FOUND", message: "User profile does not exist" },
        404
      );
    }

    return c.json(
      {
        profile: serializeProfileRow(updatedProfile),
        created_accounts_count: createdAccountsCount,
        created_categories_count: createdCategoriesCount,
      },
      200
    );
  });

  return router;
}
