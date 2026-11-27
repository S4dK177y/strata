import {
  PeriodKeySchema,
  PositiveMinorUnitsSchema,
  RecurringCadenceSchema,
  z,
} from "./common";
import { RecurringPaymentMarkSchema, RecurringPaymentSchema } from "./entities";

export const RecurringPaymentsListQuerySchema = z.object({
  active_only: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "active_only", in: "query", required: false },
      description: "Filter only active recurring payments",
    }),
  period: PeriodKeySchema.optional().openapi({
    param: { name: "period", in: "query", required: false },
    description: "Optional YYYY-MM period filter for returned payment marks",
  }),
});
export type RecurringPaymentsListQuery = z.infer<typeof RecurringPaymentsListQuerySchema>;

export const RecurringPaymentCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category_id: z.uuid().nullable().default(null),
    account_id: z.uuid().nullable().default(null),
    amount_minor: PositiveMinorUnitsSchema,
    day_of_month: z.int().min(1).max(31),
    cadence: RecurringCadenceSchema.default("monthly"),
    match_keyword: z.string().trim().max(120).nullable().default(null),
    is_active: z.boolean().default(true),
  })
  .openapi("RecurringPaymentCreateRequest");
export type RecurringPaymentCreateRequest = z.infer<typeof RecurringPaymentCreateRequestSchema>;

export const RecurringPaymentUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category_id: z.uuid().nullable().optional(),
    account_id: z.uuid().nullable().optional(),
    amount_minor: PositiveMinorUnitsSchema.optional(),
    day_of_month: z.int().min(1).max(31).optional(),
    cadence: RecurringCadenceSchema.optional(),
    match_keyword: z.string().trim().max(120).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("RecurringPaymentUpdateRequest");
export type RecurringPaymentUpdateRequest = z.infer<typeof RecurringPaymentUpdateRequestSchema>;

export const RecurringPaymentMarkRequestSchema = z
  .object({
    period_key: PeriodKeySchema,
  })
  .openapi("RecurringPaymentMarkRequest");
export type RecurringPaymentMarkRequest = z.infer<typeof RecurringPaymentMarkRequestSchema>;

export const RecurringPaymentMarkParamsSchema = z.object({
  id: z.uuid().openapi({
    param: { name: "id", in: "path" },
    example: "11111111-1111-4111-8111-111111111111",
  }),
  periodKey: PeriodKeySchema.openapi({
    param: { name: "periodKey", in: "path" },
    example: "2026-11",
  }),
});

export const RecurringPaymentResponseSchema = z
  .object({
    recurring_payment: RecurringPaymentSchema,
  })
  .openapi("RecurringPaymentResponse");
export type RecurringPaymentResponse = z.infer<typeof RecurringPaymentResponseSchema>;

export const RecurringPaymentsListResponseSchema = z
  .object({
    recurring_payments: z.array(RecurringPaymentSchema),
    marks: z.array(RecurringPaymentMarkSchema),
  })
  .openapi("RecurringPaymentsListResponse");
export type RecurringPaymentsListResponse = z.infer<typeof RecurringPaymentsListResponseSchema>;

export const RecurringPaymentMarkResponseSchema = z
  .object({
    mark: RecurringPaymentMarkSchema,
  })
  .openapi("RecurringPaymentMarkResponse");
export type RecurringPaymentMarkResponse = z.infer<typeof RecurringPaymentMarkResponseSchema>;
