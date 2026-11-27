import {
  DebtDirectionSchema,
  IsoDateSchema,
  NonNegativeMinorUnitsSchema,
  PositiveMinorUnitsSchema,
  z,
} from "./common";
import { DebtSchema } from "./entities";

export const DebtsListQuerySchema = z.object({
  direction: DebtDirectionSchema.optional().openapi({
    param: { name: "direction", in: "query", required: false },
    description: "Filter debts by direction (lent or borrowed)",
  }),
});
export type DebtsListQuery = z.infer<typeof DebtsListQuerySchema>;

export const DebtCreateRequestSchema = z
  .object({
    direction: DebtDirectionSchema,
    counterparty: z.string().trim().min(1).max(120),
    amount_minor: PositiveMinorUnitsSchema,
    manual_repaid_minor: NonNegativeMinorUnitsSchema.default(0),
    opened_at: IsoDateSchema,
    due_date: IsoDateSchema.nullable().default(null),
    comment: z.string().trim().max(1000).default(""),
  })
  .superRefine((val, ctx) => {
    if (val.manual_repaid_minor > val.amount_minor) {
      ctx.addIssue({
        code: "custom",
        message: "manual_repaid_minor cannot exceed amount_minor",
        path: ["manual_repaid_minor"],
      });
    }
  })
  .openapi("DebtCreateRequest");
export type DebtCreateRequest = z.infer<typeof DebtCreateRequestSchema>;

export const DebtUpdateRequestSchema = z
  .object({
    direction: DebtDirectionSchema.optional(),
    counterparty: z.string().trim().min(1).max(120).optional(),
    amount_minor: PositiveMinorUnitsSchema.optional(),
    manual_repaid_minor: NonNegativeMinorUnitsSchema.optional(),
    opened_at: IsoDateSchema.optional(),
    due_date: IsoDateSchema.nullable().optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .superRefine((val, ctx) => {
    if (
      val.amount_minor !== undefined &&
      val.manual_repaid_minor !== undefined &&
      val.manual_repaid_minor > val.amount_minor
    ) {
      ctx.addIssue({
        code: "custom",
        message: "manual_repaid_minor cannot exceed amount_minor",
        path: ["manual_repaid_minor"],
      });
    }
  })
  .openapi("DebtUpdateRequest");
export type DebtUpdateRequest = z.infer<typeof DebtUpdateRequestSchema>;

export const DebtResponseSchema = z
  .object({
    debt: DebtSchema,
  })
  .openapi("DebtResponse");
export type DebtResponse = z.infer<typeof DebtResponseSchema>;

export const DebtsListResponseSchema = z
  .object({
    debts: z.array(DebtSchema),
  })
  .openapi("DebtsListResponse");
export type DebtsListResponse = z.infer<typeof DebtsListResponseSchema>;
