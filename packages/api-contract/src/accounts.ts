import {
  AccountTypeSchema,
  CurrencyCodeSchema,
  MinorUnitsSchema,
  NonNegativeMinorUnitsSchema,
  z,
} from "./common";
import { AccountSchema } from "./entities";

export const AccountsListQuerySchema = z.object({
  active_only: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "active_only", in: "query", required: false },
      description: "Filter to active (non-archived) accounts when true",
    }),
});
export type AccountsListQuery = z.infer<typeof AccountsListQuerySchema>;

export const AccountCreateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: AccountTypeSchema,
    currency: CurrencyCodeSchema.default("RUB"),
    initial_balance_minor: MinorUnitsSchema.default(0),
    credit_limit_minor: NonNegativeMinorUnitsSchema.default(0),
    bank_name: z.string().trim().max(120).nullable().optional(),
    last4_digits: z
      .string()
      .regex(/^\d{4}$/)
      .nullable()
      .optional(),
    is_active: z.boolean().default(true),
    sort_order: z.int().optional(),
  })
  .openapi("AccountCreateRequest");
export type AccountCreateRequest = z.infer<typeof AccountCreateRequestSchema>;

export const AccountUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type: AccountTypeSchema.optional(),
    currency: CurrencyCodeSchema.optional(),
    initial_balance_minor: MinorUnitsSchema.optional(),
    credit_limit_minor: NonNegativeMinorUnitsSchema.optional(),
    bank_name: z.string().trim().max(120).nullable().optional(),
    last4_digits: z
      .string()
      .regex(/^\d{4}$/)
      .nullable()
      .optional(),
    is_active: z.boolean().optional(),
    sort_order: z.int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("AccountUpdateRequest");
export type AccountUpdateRequest = z.infer<typeof AccountUpdateRequestSchema>;

export const AccountResponseSchema = z
  .object({
    account: AccountSchema,
  })
  .openapi("AccountResponse");
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const AccountsListResponseSchema = z
  .object({
    accounts: z.array(AccountSchema),
  })
  .openapi("AccountsListResponse");
export type AccountsListResponse = z.infer<typeof AccountsListResponseSchema>;
