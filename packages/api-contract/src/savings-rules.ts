import {
  IsoDateSchema,
  NonNegativeMinorUnitsSchema,
  RateDecimalSchema,
  SavingsAccrualTypeSchema,
  z,
} from "./common";
import { SavingsRuleSchema } from "./entities";

export const SavingsRuleCreateRequestSchema = z
  .object({
    account_id: z.uuid(),
    accrual_type: SavingsAccrualTypeSchema.default("daily_balance"),
    base_rate: RateDecimalSchema,
    promo_rate: RateDecimalSchema.default(0),
    promo_end_date: IsoDateSchema.nullable().default(null),
    capitalization: z.boolean().default(true),
    min_balance_override_minor: NonNegativeMinorUnitsSchema.nullable().default(null),
  })
  .superRefine((val, ctx) => {
    if (val.promo_rate > 0 && !val.promo_end_date) {
      ctx.addIssue({
        code: "custom",
        message: "promo_end_date is required when promo_rate > 0",
        path: ["promo_end_date"],
      });
    }
  })
  .openapi("SavingsRuleCreateRequest");
export type SavingsRuleCreateRequest = z.infer<typeof SavingsRuleCreateRequestSchema>;

export const SavingsRuleUpdateRequestSchema = z
  .object({
    accrual_type: SavingsAccrualTypeSchema.optional(),
    base_rate: RateDecimalSchema.optional(),
    promo_rate: RateDecimalSchema.optional(),
    promo_end_date: IsoDateSchema.nullable().optional(),
    capitalization: z.boolean().optional(),
    min_balance_override_minor: NonNegativeMinorUnitsSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("SavingsRuleUpdateRequest");
export type SavingsRuleUpdateRequest = z.infer<typeof SavingsRuleUpdateRequestSchema>;

export const SavingsRuleResponseSchema = z
  .object({
    savings_rule: SavingsRuleSchema,
  })
  .openapi("SavingsRuleResponse");
export type SavingsRuleResponse = z.infer<typeof SavingsRuleResponseSchema>;

export const SavingsRulesListResponseSchema = z
  .object({
    savings_rules: z.array(SavingsRuleSchema),
  })
  .openapi("SavingsRulesListResponse");
export type SavingsRulesListResponse = z.infer<typeof SavingsRulesListResponseSchema>;
