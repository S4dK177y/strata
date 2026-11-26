import {
  CategoryKindSchema,
  NonNegativeMinorUnitsSchema,
  z,
} from "./common";
import { CategorySchema } from "./entities";

export const CategoriesListQuerySchema = z.object({
  kind: CategoryKindSchema.optional().openapi({
    param: { name: "kind", in: "query", required: false },
    description: "Filter categories by expense or income kind",
  }),
});
export type CategoriesListQuery = z.infer<typeof CategoriesListQuerySchema>;

export const CategoryCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: CategoryKindSchema,
    is_passive: z.boolean().default(false),
    monthly_limit_minor: NonNegativeMinorUnitsSchema.nullable().optional(),
    icon: z.string().trim().max(64).nullable().optional(),
    color: z.string().trim().max(64).nullable().optional(),
    hint: z.string().trim().max(240).nullable().optional(),
    sort_order: z.int().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "expense" && val.is_passive) {
      ctx.addIssue({
        code: "custom",
        message: "Expense categories cannot be marked as passive income",
        path: ["is_passive"],
      });
    }
  })
  .openapi("CategoryCreateRequest");
export type CategoryCreateRequest = z.infer<typeof CategoryCreateRequestSchema>;

export const CategoryUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    kind: CategoryKindSchema.optional(),
    is_passive: z.boolean().optional(),
    monthly_limit_minor: NonNegativeMinorUnitsSchema.nullable().optional(),
    icon: z.string().trim().max(64).nullable().optional(),
    color: z.string().trim().max(64).nullable().optional(),
    hint: z.string().trim().max(240).nullable().optional(),
    sort_order: z.int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .superRefine((val, ctx) => {
    if (val.kind === "expense" && val.is_passive === true) {
      ctx.addIssue({
        code: "custom",
        message: "Expense categories cannot be marked as passive income",
        path: ["is_passive"],
      });
    }
  })
  .openapi("CategoryUpdateRequest");
export type CategoryUpdateRequest = z.infer<typeof CategoryUpdateRequestSchema>;

export const CategoryResponseSchema = z
  .object({
    category: CategorySchema,
  })
  .openapi("CategoryResponse");
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

export const CategoriesListResponseSchema = z
  .object({
    categories: z.array(CategorySchema),
  })
  .openapi("CategoriesListResponse");
export type CategoriesListResponse = z.infer<typeof CategoriesListResponseSchema>;
