import {
  AccountTypeSchema,
  CategoryKindSchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  MinorUnitsSchema,
  NonNegativeMinorUnitsSchema,
  ThemeSchema,
  WrappedSettingsSchema,
  z,
} from "./common";
import { ProfileSchema } from "./entities";

export const ProfileUpdateRequestSchema = z
  .object({
    display_name: z.string().trim().max(120).optional(),
    locale: LocaleSchema.optional(),
    base_currency: CurrencyCodeSchema.optional(),
    theme: ThemeSchema.optional(),
    privacy_blur_default: z.boolean().optional(),
    onboarding_completed: z.boolean().optional(),
    wrapped_settings: WrappedSettingsSchema.partial().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("ProfileUpdateRequest");
export type ProfileUpdateRequest = z.infer<typeof ProfileUpdateRequestSchema>;

export const RedeemInviteRequestSchema = z
  .object({
    code: z.string().trim().min(4).max(64).openapi({ example: "STRATA-BETA-2026" }),
  })
  .openapi("RedeemInviteRequest");
export type RedeemInviteRequest = z.infer<typeof RedeemInviteRequestSchema>;

export const RedeemInviteResponseSchema = z
  .object({
    invite_redeemed_at: IsoDateTimeSchema,
    invite_required: z.literal(false),
  })
  .openapi("RedeemInviteResponse");
export type RedeemInviteResponse = z.infer<typeof RedeemInviteResponseSchema>;

export const OnboardingAccountInputSchema = z
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
  })
  .openapi("OnboardingAccountInput");
export type OnboardingAccountInput = z.infer<typeof OnboardingAccountInputSchema>;

export const OnboardingCategoryInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    kind: CategoryKindSchema,
    is_passive: z.boolean().default(false),
    monthly_limit_minor: NonNegativeMinorUnitsSchema.nullable().optional(),
    icon: z.string().max(64).nullable().optional(),
    color: z.string().max(64).nullable().optional(),
  })
  .openapi("OnboardingCategoryInput");
export type OnboardingCategoryInput = z.infer<typeof OnboardingCategoryInputSchema>;

export const OnboardingCompleteRequestSchema = z
  .object({
    display_name: z.string().trim().max(120).optional(),
    locale: LocaleSchema,
    base_currency: CurrencyCodeSchema,
    theme: ThemeSchema,
    privacy_blur_default: z.boolean().default(false),
    accounts: z.array(OnboardingAccountInputSchema).max(20).default([]),
    categories: z.array(OnboardingCategoryInputSchema).max(40).default([]),
  })
  .openapi("OnboardingCompleteRequest");
export type OnboardingCompleteRequest = z.infer<typeof OnboardingCompleteRequestSchema>;

export const OnboardingCompleteResponseSchema = z
  .object({
    profile: ProfileSchema,
    created_accounts_count: z.int().nonnegative(),
    created_categories_count: z.int().nonnegative(),
  })
  .openapi("OnboardingCompleteResponse");
export type OnboardingCompleteResponse = z.infer<typeof OnboardingCompleteResponseSchema>;
