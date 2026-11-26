import { randomBytes } from "node:crypto";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AdminFeatureFlagsResponseSchema,
  AdminTelemetryResponseSchema,
  AdminTelemetrySchema,
  CreateInviteCodeRequestSchema,
  DeletedInviteResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  FeatureFlagKeyParamSchema,
  FeatureFlagResponseSchema,
  InviteCodeListResponseSchema,
  InviteCodeResponseSchema,
  UpdateFeatureFlagRequestSchema,
  UpdateInviteCodeRequestSchema,
  type FeatureFlag,
  type InviteCode,
} from "@strata/api-contract";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createRequireAuth, requireAdmin, requireMfaVerified } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]);
  return `STRATA-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

function serializeFeatureFlag(
  row: Database["public"]["Tables"]["feature_flags"]["Row"]
): FeatureFlag {
  return {
    key: row.key,
    enabled: row.enabled,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    admin_preview: row.admin_preview,
    config:
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {},
    updated_at: row.updated_at,
  };
}

const getTelemetryRoute = createRoute({
  method: "get",
  path: "/admin/telemetry",
  tags: ["Admin"],
  summary: "Get aggregate-only platform telemetry (no user PII or financial rows)",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "Aggregate telemetry counts",
      content: { "application/json": { schema: AdminTelemetryResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Admin or MFA required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to load telemetry",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const listInvitesRoute = createRoute({
  method: "get",
  path: "/admin/invites",
  tags: ["Admin"],
  summary: "List invite codes",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "List of invite codes",
      content: { "application/json": { schema: InviteCodeListResponseSchema } },
    },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to load invites", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

const createInviteRoute = createRoute({
  method: "post",
  path: "/admin/invites",
  tags: ["Admin"],
  summary: "Create a new invite code (auto-generates code if omitted)",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateInviteCodeRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Created invite code",
      content: { "application/json": { schema: InviteCodeResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "Invite code already exists", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to create invite", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

const updateInviteRoute = createRoute({
  method: "patch",
  path: "/admin/invites/{id}",
  tags: ["Admin"],
  summary: "Update invite code limits, expiration, note, or active status",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateInviteCodeRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated invite code",
      content: { "application/json": { schema: InviteCodeResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Invite not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to update invite", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

const deleteInviteRoute = createRoute({
  method: "delete",
  path: "/admin/invites/{id}",
  tags: ["Admin"],
  summary: "Delete an invite code",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Invite deleted",
      content: { "application/json": { schema: DeletedInviteResponseSchema } },
    },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Invite not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to delete invite", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

const listAdminFlagsRoute = createRoute({
  method: "get",
  path: "/admin/feature-flags",
  tags: ["Admin"],
  summary: "List all cloud feature flags including admin_preview entries",
  security: AUTH_SECURITY,
  responses: {
    200: {
      description: "All feature flags",
      content: { "application/json": { schema: AdminFeatureFlagsResponseSchema } },
    },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to load feature flags", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

const updateAdminFlagRoute = createRoute({
  method: "patch",
  path: "/admin/feature-flags/{key}",
  tags: ["Admin"],
  summary: "Update a cloud feature flag",
  security: AUTH_SECURITY,
  request: {
    params: FeatureFlagKeyParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateFeatureFlagRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated feature flag",
      content: { "application/json": { schema: FeatureFlagResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Authentication required", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Admin or MFA required", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Feature flag not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    500: { description: "Failed to update feature flag", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export function createAdminRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/admin/*", requireAuth, requireMfaVerified, requireAdmin);

  router.openapi(getTelemetryRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase.rpc("get_admin_telemetry");
    if (error) {
      return c.json(
        { error: "ADMIN_TELEMETRY_FAILED", message: error.message },
        500
      );
    }

    const parsed = AdminTelemetrySchema.safeParse(data);
    if (!parsed.success) {
      return c.json(
        { error: "ADMIN_TELEMETRY_INVALID", message: "Invalid telemetry payload" },
        500
      );
    }

    return c.json({ telemetry: parsed.data }, 200);
  });

  router.openapi(listInvitesRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return c.json(
        { error: "ADMIN_INVITES_LOAD_FAILED", message: error.message },
        500
      );
    }

    return c.json({ invites: (data ?? []) as InviteCode[] }, 200);
  });

  router.openapi(createInviteRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    const code = body.code && body.code.length > 0 ? body.code : generateInviteCode();

    const { data, error } = await auth.supabase
      .from("invite_codes")
      .insert({
        code,
        max_uses: body.max_uses,
        expires_at: body.expires_at ?? null,
        note: body.note ?? "",
        is_active: body.is_active,
        created_by: auth.userId,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return c.json(
          { error: "INVITE_CODE_EXISTS", message: "An invite with this code already exists" },
          409
        );
      }
      return c.json(
        { error: "ADMIN_INVITE_CREATE_FAILED", message: error.message },
        500
      );
    }

    return c.json({ invite: data as InviteCode }, 201);
  });

  router.openapi(updateInviteRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const patch: Database["public"]["Tables"]["invite_codes"]["Update"] = {};

    if (body.max_uses !== undefined) patch.max_uses = body.max_uses;
    if (body.expires_at !== undefined) patch.expires_at = body.expires_at;
    if (body.note !== undefined) patch.note = body.note ?? "";
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const { data, error } = await auth.supabase
      .from("invite_codes")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json(
        { error: "ADMIN_INVITE_UPDATE_FAILED", message: error.message },
        500
      );
    }

    if (!data) {
      return c.json({ error: "INVITE_NOT_FOUND", message: "Invite code not found" }, 404);
    }

    return c.json({ invite: data as InviteCode }, 200);
  });

  router.openapi(deleteInviteRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const { data, error } = await auth.supabase
      .from("invite_codes")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return c.json(
        { error: "ADMIN_INVITE_DELETE_FAILED", message: error.message },
        500
      );
    }

    if (!data) {
      return c.json({ error: "INVITE_NOT_FOUND", message: "Invite code not found" }, 404);
    }

    return c.json({ id: data.id, deleted: true as const }, 200);
  });

  router.openapi(listAdminFlagsRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { data, error } = await auth.supabase
      .from("feature_flags")
      .select("*")
      .order("key", { ascending: true });

    if (error) {
      return c.json(
        { error: "ADMIN_FLAGS_LOAD_FAILED", message: error.message },
        500
      );
    }

    return c.json(
      { flags: (data ?? []).map(serializeFeatureFlag) },
      200
    );
  });

  router.openapi(updateAdminFlagRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { key } = c.req.valid("param");
    const body = c.req.valid("json");
    const patch: Database["public"]["Tables"]["feature_flags"]["Update"] = {};

    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.admin_preview !== undefined) patch.admin_preview = body.admin_preview;
    if (body.starts_at !== undefined) patch.starts_at = body.starts_at;
    if (body.ends_at !== undefined) patch.ends_at = body.ends_at;
    if (body.config !== undefined) patch.config = body.config as Json;

    const { data, error } = await auth.supabase
      .from("feature_flags")
      .update(patch)
      .eq("key", key)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json(
        { error: "ADMIN_FLAG_UPDATE_FAILED", message: error.message },
        500
      );
    }

    if (!data) {
      return c.json({ error: "FEATURE_FLAG_NOT_FOUND", message: "Feature flag not found" }, 404);
    }

    return c.json({ flag: serializeFeatureFlag(data) }, 200);
  });

  return router;
}
