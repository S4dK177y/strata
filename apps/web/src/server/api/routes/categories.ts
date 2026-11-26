import { createRoute } from "@hono/zod-openapi";
import {
  CategoriesListQuerySchema,
  CategoriesListResponseSchema,
  CategoryCreateRequestSchema,
  CategoryResponseSchema,
  CategoryUpdateRequestSchema,
  DeletedEntityResponseSchema,
  EntityIdParamSchema,
  ErrorResponseSchema,
  type Category,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import { AUTH_SECURITY, createSubRouter } from "../router";
import type { ApiDependencies } from "../types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

function serializeCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    kind: row.kind as Category["kind"],
    is_passive: row.is_passive,
    monthly_limit_minor: row.monthly_limit_minor,
    icon: row.icon,
    color: row.color,
    hint: row.hint,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

const listCategoriesRoute = createRoute({
  method: "get",
  path: "/categories",
  tags: ["Categories"],
  summary: "List user's non-deleted categories",
  security: AUTH_SECURITY,
  request: {
    query: CategoriesListQuerySchema,
  },
  responses: {
    200: {
      description: "List of categories",
      content: { "application/json": { schema: CategoriesListResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to load categories",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const createCategoryRoute = createRoute({
  method: "post",
  path: "/categories",
  tags: ["Categories"],
  summary: "Create a new expense or income category",
  security: AUTH_SECURITY,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CategoryCreateRequestSchema } },
    },
  },
  responses: {
    201: {
      description: "Category created",
      content: { "application/json": { schema: CategoryResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to create category",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const updateCategoryRoute = createRoute({
  method: "patch",
  path: "/categories/{id}",
  tags: ["Categories"],
  summary: "Update an existing category",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: CategoryUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Category updated",
      content: { "application/json": { schema: CategoryResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Category not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to update category",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const deleteCategoryRoute = createRoute({
  method: "delete",
  path: "/categories/{id}",
  tags: ["Categories"],
  summary: "Soft-delete a category",
  security: AUTH_SECURITY,
  request: {
    params: EntityIdParamSchema,
  },
  responses: {
    200: {
      description: "Category soft-deleted",
      content: { "application/json": { schema: DeletedEntityResponseSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Category not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Failed to delete category",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createCategoriesRouter(deps: ApiDependencies) {
  const router = createSubRouter();
  const requireAuth = createRequireAuth(deps);

  router.use("/categories", requireAuth, requireInviteGate);
  router.use("/categories/*", requireAuth, requireInviteGate);

  router.openapi(listCategoriesRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { kind } = c.req.valid("query");
    let query = auth.supabase
      .from("categories")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (kind) {
      query = query.eq("kind", kind);
    }

    const { data, error } = await query;
    if (error) {
      return c.json({ error: "CATEGORIES_LOAD_FAILED", message: error.message }, 500);
    }

    return c.json({ categories: (data ?? []).map(serializeCategoryRow) }, 200);
  });

  router.openapi(createCategoryRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const body = c.req.valid("json");
    let sortOrder = body.sort_order;
    if (sortOrder === undefined) {
      const { data: existing } = await auth.supabase
        .from("categories")
        .select("sort_order")
        .eq("user_id", auth.userId)
        .eq("kind", body.kind)
        .is("deleted_at", null);

      const maxOrder = (existing ?? []).reduce(
        (max, row) => Math.max(max, row.sort_order ?? 0),
        -1
      );
      sortOrder = maxOrder + 1;
    }

    const insertRow: Database["public"]["Tables"]["categories"]["Insert"] = {
      user_id: auth.userId,
      name: body.name,
      kind: body.kind,
      is_passive: body.kind === "income" ? body.is_passive : false,
      monthly_limit_minor:
        body.kind === "expense" ? (body.monthly_limit_minor ?? null) : null,
      icon: body.icon ? body.icon : null,
      color: body.color ? body.color : null,
      hint: body.hint ? body.hint : null,
      sort_order: sortOrder,
    };

    const { data, error } = await auth.supabase
      .from("categories")
      .insert(insertRow)
      .select("*")
      .single();

    if (error || !data) {
      return c.json(
        { error: "CATEGORY_CREATE_FAILED", message: error?.message ?? "Insert failed" },
        500
      );
    }

    return c.json({ category: serializeCategoryRow(data) }, 201);
  });

  router.openapi(updateCategoryRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const { data: existing, error: fetchError } = await auth.supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError) {
      return c.json({ error: "CATEGORIES_LOAD_FAILED", message: fetchError.message }, 500);
    }

    if (!existing) {
      return c.json({ error: "CATEGORY_NOT_FOUND", message: "Category not found" }, 404);
    }

    const nextKind = body.kind ?? (existing.kind as Category["kind"]);
    if (nextKind === "expense" && body.is_passive === true) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          message: "Expense categories cannot be marked as passive income",
        },
        400
      );
    }

    const patch: Database["public"]["Tables"]["categories"]["Update"] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.kind !== undefined) patch.kind = body.kind;
    if (nextKind === "expense") {
      if (existing.is_passive || body.is_passive !== undefined) {
        patch.is_passive = false;
      }
    } else if (body.is_passive !== undefined) {
      patch.is_passive = body.is_passive;
    }

    if (nextKind === "income") {
      if (existing.monthly_limit_minor !== null || body.monthly_limit_minor !== undefined) {
        patch.monthly_limit_minor = null;
      }
    } else if (body.monthly_limit_minor !== undefined) {
      patch.monthly_limit_minor = body.monthly_limit_minor;
    }

    if (body.icon !== undefined) patch.icon = body.icon ? body.icon : null;
    if (body.color !== undefined) patch.color = body.color ? body.color : null;
    if (body.hint !== undefined) patch.hint = body.hint ? body.hint : null;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;

    const { data, error } = await auth.supabase
      .from("categories")
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return c.json({ error: "CATEGORY_UPDATE_FAILED", message: error.message }, 500);
    }

    if (!data) {
      return c.json({ error: "CATEGORY_NOT_FOUND", message: "Category not found" }, 404);
    }

    return c.json({ category: serializeCategoryRow(data) }, 200);
  });

  router.openapi(deleteCategoryRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const { id } = c.req.valid("param");
    const deletedAt = new Date().toISOString();

    const { data, error } = await auth.supabase
      .from("categories")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id, deleted_at")
      .maybeSingle();

    if (error) {
      return c.json({ error: "CATEGORY_DELETE_FAILED", message: error.message }, 500);
    }

    if (!data || !data.deleted_at) {
      return c.json({ error: "CATEGORY_NOT_FOUND", message: "Category not found" }, 404);
    }

    return c.json({ id: data.id, deleted_at: data.deleted_at }, 200);
  });

  return router;
}
