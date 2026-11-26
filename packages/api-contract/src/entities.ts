import {
  AccentPaletteSchema,
  AccountTypeSchema,
  CategoryKindSchema,
  CurrencyCodeSchema,
  DebtDirectionSchema,
  GoalPrioritySchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  MinorUnitsSchema,
  NonNegativeMinorUnitsSchema,
  PeriodKeySchema,
  PositiveMinorUnitsSchema,
  RateDecimalSchema,
  RecurringCadenceSchema,
  SavingsAccrualTypeSchema,
  SyncFieldsSchema,
  ThemeSchema,
  TransactionSourceSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  UserRoleSchema,
  WrappedSettingsSchema,
  z,
} from "./common";
import { AalLevelSchema } from "./security";

export const ProfileSchema = z
  .object({
    id: z.uuid(),
    role: UserRoleSchema,
    display_name: z.string(),
    locale: LocaleSchema,
    base_currency: CurrencyCodeSchema,
    theme: ThemeSchema,
    accent: AccentPaletteSchema.default("emerald"),
    privacy_blur_default: z.boolean(),
    onboarding_completed: z.boolean(),
    invite_redeemed_at: IsoDateTimeSchema.nullable(),
    tour_completed_at: IsoDateTimeSchema.nullable().default(null),
    dashboard_layout: z.array(z.string()).nullable().default(null),
    wrapped_settings: WrappedSettingsSchema,
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .openapi("Profile");
export type Profile = z.infer<typeof ProfileSchema>;

export const InviteCodeSchema = z
  .object({
    id: z.uuid(),
    code: z.string().min(4),
    max_uses: z.int().positive().nullable(),
    used_count: z.int().nonnegative(),
    expires_at: IsoDateTimeSchema.nullable(),
    note: z.string().nullable(),
    is_active: z.boolean(),
    created_by: z.uuid().nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .openapi("InviteCode");
export type InviteCode = z.infer<typeof InviteCodeSchema>;

export const AccountSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  name: z.string().min(1),
  type: AccountTypeSchema,
  currency: CurrencyCodeSchema,
  initial_balance_minor: MinorUnitsSchema,
  credit_limit_minor: NonNegativeMinorUnitsSchema,
  bank_name: z.string().nullable(),
  last4_digits: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  is_active: z.boolean(),
  sort_order: z.int(),
}).openapi("Account");
export type Account = z.infer<typeof AccountSchema>;

export const SavingsRuleSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  account_id: z.uuid(),
  accrual_type: SavingsAccrualTypeSchema,
  base_rate: RateDecimalSchema,
  promo_rate: RateDecimalSchema,
  promo_end_date: IsoDateSchema.nullable(),
  capitalization: z.boolean(),
  min_balance_override_minor: NonNegativeMinorUnitsSchema.nullable(),
}).openapi("SavingsRule");
export type SavingsRule = z.infer<typeof SavingsRuleSchema>;

export const CategorySchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  name: z.string().min(1),
  kind: CategoryKindSchema,
  is_passive: z.boolean(),
  monthly_limit_minor: NonNegativeMinorUnitsSchema.nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  hint: z.string().nullable(),
  sort_order: z.int(),
}).openapi("Category");
export type Category = z.infer<typeof CategorySchema>;

export const GoalSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  name: z.string().min(1),
  priority: GoalPrioritySchema,
  target_amount_minor: PositiveMinorUnitsSchema,
  initial_amount_minor: NonNegativeMinorUnitsSchema,
  monthly_plan_minor: NonNegativeMinorUnitsSchema,
  storage_account_id: z.uuid().nullable(),
  is_archived: z.boolean(),
  sort_order: z.int(),
}).openapi("Goal");
export type Goal = z.infer<typeof GoalSchema>;

export const GoalTransferSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  from_goal_id: z.uuid(),
  to_goal_id: z.uuid(),
  amount_minor: PositiveMinorUnitsSchema,
  occurred_at: IsoDateTimeSchema,
  comment: z.string(),
}).openapi("GoalTransfer");
export type GoalTransfer = z.infer<typeof GoalTransferSchema>;

export const RecurringPaymentSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  name: z.string().min(1),
  category_id: z.uuid().nullable(),
  account_id: z.uuid().nullable(),
  amount_minor: PositiveMinorUnitsSchema,
  day_of_month: z.int().min(1).max(31),
  cadence: RecurringCadenceSchema,
  match_keyword: z.string().nullable(),
  is_active: z.boolean(),
}).openapi("RecurringPayment");
export type RecurringPayment = z.infer<typeof RecurringPaymentSchema>;

export const RecurringPaymentMarkSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  recurring_payment_id: z.uuid(),
  period_key: PeriodKeySchema,
  marked_at: IsoDateTimeSchema,
}).openapi("RecurringPaymentMark");
export type RecurringPaymentMark = z.infer<typeof RecurringPaymentMarkSchema>;

export const DebtSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  direction: DebtDirectionSchema,
  counterparty: z.string().min(1),
  amount_minor: PositiveMinorUnitsSchema,
  manual_repaid_minor: NonNegativeMinorUnitsSchema,
  opened_at: IsoDateSchema,
  due_date: IsoDateSchema.nullable(),
  comment: z.string(),
}).openapi("Debt");
export type Debt = z.infer<typeof DebtSchema>;

export const TransactionSchema = SyncFieldsSchema.extend({
  user_id: z.uuid(),
  occurred_at: IsoDateTimeSchema,
  type: TransactionTypeSchema,
  amount_minor: PositiveMinorUnitsSchema,
  category_id: z.uuid().nullable(),
  account_from_id: z.uuid().nullable(),
  account_to_id: z.uuid().nullable(),
  goal_id: z.uuid().nullable(),
  debt_id: z.uuid().nullable(),
  recurring_payment_id: z.uuid().nullable(),
  comment: z.string(),
  status: TransactionStatusSchema,
  source: TransactionSourceSchema,
  external_hash: z.string().nullable(),
}).openapi("Transaction");
export type Transaction = z.infer<typeof TransactionSchema>;

export const FeatureFlagSchema = z
  .object({
    key: z.string().min(1),
    enabled: z.boolean(),
    starts_at: IsoDateTimeSchema.nullable(),
    ends_at: IsoDateTimeSchema.nullable(),
    admin_preview: z.boolean(),
    config: z.record(z.string(), z.unknown()),
    updated_at: IsoDateTimeSchema,
  })
  .openapi("FeatureFlag");
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const FeatureFlagsResponseSchema = z
  .object({
    flags: z.array(FeatureFlagSchema),
    server_time: IsoDateTimeSchema,
  })
  .openapi("FeatureFlagsResponse");
export type FeatureFlagsResponse = z.infer<typeof FeatureFlagsResponseSchema>;

export const StorySlideSchema = z
  .object({
    id: z.uuid(),
    story_id: z.uuid(),
    slide_order: z.int().nonnegative(),
    title_ru: z.string(),
    title_en: z.string(),
    body_ru: z.string(),
    body_en: z.string(),
    media_url: z.string().nullable(),
    cta_label_ru: z.string().nullable(),
    cta_label_en: z.string().nullable(),
    cta_href: z.string().nullable(),
    accent_token: z.string().nullable(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
  })
  .openapi("StorySlide");
export type StorySlide = z.infer<typeof StorySlideSchema>;

export const StorySchema = SyncFieldsSchema.extend({
  slug: z.string().min(1),
  title_ru: z.string(),
  title_en: z.string(),
  cover_image_url: z.string().nullable(),
  badge_ru: z.string().nullable(),
  badge_en: z.string().nullable(),
  is_published: z.boolean(),
  admin_preview: z.boolean(),
  starts_at: IsoDateTimeSchema.nullable(),
  ends_at: IsoDateTimeSchema.nullable(),
  sort_order: z.int(),
  created_by: z.uuid().nullable(),
  slides: z.array(StorySlideSchema).optional(),
}).openapi("Story");
export type Story = z.infer<typeof StorySchema>;

export const AdminTelemetrySchema = z
  .object({
    total_users: z.int().nonnegative(),
    onboarded_users: z.int().nonnegative(),
    invited_users: z.int().nonnegative(),
    total_accounts: z.int().nonnegative(),
    total_transactions: z.int().nonnegative(),
    transactions_last_30d: z.int().nonnegative(),
    total_goals: z.int().nonnegative(),
    total_debts: z.int().nonnegative(),
    active_invites: z.int().nonnegative(),
    story_views_total: z.int().nonnegative(),
    generated_at: IsoDateTimeSchema,
  })
  .openapi("AdminTelemetry");
export type AdminTelemetry = z.infer<typeof AdminTelemetrySchema>;

export const MeResponseSchema = z
  .object({
    profile: ProfileSchema,
    email: z.string().nullable(),
    invite_required: z.boolean(),
    aal: AalLevelSchema.default("aal1"),
    mfa_enabled: z.boolean().default(false),
    mfa_required: z.boolean().default(false),
  })
  .openapi("MeResponse");
export type MeResponse = z.infer<typeof MeResponseSchema>;
