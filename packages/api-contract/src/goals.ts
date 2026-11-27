import {
  GoalPrioritySchema,
  IsoDateTimeSchema,
  NonNegativeMinorUnitsSchema,
  PositiveMinorUnitsSchema,
  z,
} from "./common";
import { GoalSchema, GoalTransferSchema } from "./entities";

export const GoalsListQuerySchema = z.object({
  include_archived: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "include_archived", in: "query", required: false },
      description: "Include archived goals (defaults to true)",
    }),
});
export type GoalsListQuery = z.infer<typeof GoalsListQuerySchema>;

export const GoalCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    priority: GoalPrioritySchema.default("medium"),
    target_amount_minor: PositiveMinorUnitsSchema,
    initial_amount_minor: NonNegativeMinorUnitsSchema.default(0),
    monthly_plan_minor: NonNegativeMinorUnitsSchema.default(0),
    storage_account_id: z.uuid().nullable().default(null),
    is_archived: z.boolean().default(false),
    sort_order: z.int().default(0),
  })
  .openapi("GoalCreateRequest");
export type GoalCreateRequest = z.infer<typeof GoalCreateRequestSchema>;

export const GoalUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    priority: GoalPrioritySchema.optional(),
    target_amount_minor: PositiveMinorUnitsSchema.optional(),
    initial_amount_minor: NonNegativeMinorUnitsSchema.optional(),
    monthly_plan_minor: NonNegativeMinorUnitsSchema.optional(),
    storage_account_id: z.uuid().nullable().optional(),
    is_archived: z.boolean().optional(),
    sort_order: z.int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("GoalUpdateRequest");
export type GoalUpdateRequest = z.infer<typeof GoalUpdateRequestSchema>;

export const GoalResponseSchema = z
  .object({
    goal: GoalSchema,
  })
  .openapi("GoalResponse");
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

export const GoalsListResponseSchema = z
  .object({
    goals: z.array(GoalSchema),
    goal_transfers: z.array(GoalTransferSchema),
  })
  .openapi("GoalsListResponse");
export type GoalsListResponse = z.infer<typeof GoalsListResponseSchema>;

export const GoalTransfersListQuerySchema = z.object({
  goal_id: z.uuid().optional().openapi({
    param: { name: "goal_id", in: "query", required: false },
    description: "Optional goal ID filter (matches either from_goal_id or to_goal_id)",
  }),
});
export type GoalTransfersListQuery = z.infer<typeof GoalTransfersListQuerySchema>;

export const GoalTransferCreateRequestSchema = z
  .object({
    from_goal_id: z.uuid(),
    to_goal_id: z.uuid(),
    amount_minor: PositiveMinorUnitsSchema,
    occurred_at: IsoDateTimeSchema.optional(),
    comment: z.string().trim().max(500).default(""),
  })
  .superRefine((val, ctx) => {
    if (val.from_goal_id === val.to_goal_id) {
      ctx.addIssue({
        code: "custom",
        message: "from_goal_id and to_goal_id must differ",
        path: ["to_goal_id"],
      });
    }
  })
  .openapi("GoalTransferCreateRequest");
export type GoalTransferCreateRequest = z.infer<typeof GoalTransferCreateRequestSchema>;

export const GoalTransferResponseSchema = z
  .object({
    goal_transfer: GoalTransferSchema,
  })
  .openapi("GoalTransferResponse");
export type GoalTransferResponse = z.infer<typeof GoalTransferResponseSchema>;

export const GoalTransfersListResponseSchema = z
  .object({
    goal_transfers: z.array(GoalTransferSchema),
  })
  .openapi("GoalTransfersListResponse");
export type GoalTransfersListResponse = z.infer<typeof GoalTransfersListResponseSchema>;
