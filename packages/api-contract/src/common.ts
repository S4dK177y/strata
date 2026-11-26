import { z } from "@hono/zod-openapi";

export { z };

export const AccountTypeSchema = z
  .enum(["debit", "credit", "cash", "savings", "deposit"])
  .openapi("AccountType");
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const TransactionTypeSchema = z
  .enum([
    "expense",
    "income",
    "passive_income",
    "transfer",
    "compensation",
    "transit_in",
    "transit_out",
    "debt_given",
    "debt_received_back",
    "debt_borrowed",
    "debt_paid_back",
  ])
  .openapi("TransactionType");
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const DebtDirectionSchema = z.enum(["lent", "borrowed"]).openapi("DebtDirection");
export type DebtDirection = z.infer<typeof DebtDirectionSchema>;

export const SavingsAccrualTypeSchema = z
  .enum(["daily_balance", "min_balance"])
  .openapi("SavingsAccrualType");
export type SavingsAccrualType = z.infer<typeof SavingsAccrualTypeSchema>;

export const GoalPrioritySchema = z.enum(["high", "medium", "low"]).openapi("GoalPriority");
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;

export const RecurringCadenceSchema = z
  .enum(["weekly", "monthly", "quarterly", "yearly"])
  .openapi("RecurringCadence");
export type RecurringCadence = z.infer<typeof RecurringCadenceSchema>;

export const CategoryKindSchema = z.enum(["expense", "income"]).openapi("CategoryKind");
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const TransactionStatusSchema = z
  .enum(["confirmed", "draft"])
  .openapi("TransactionStatus");
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionSourceSchema = z
  .enum(["web", "android", "android_push"])
  .openapi("TransactionSource");
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const LocaleSchema = z.enum(["ru", "en"]).openapi("Locale");
export type Locale = z.infer<typeof LocaleSchema>;

export const ThemeSchema = z.enum(["light", "dark", "system"]).openapi("Theme");
export type Theme = z.infer<typeof ThemeSchema>;

export const AccentPaletteSchema = z
  .enum(["emerald", "ocean", "amethyst", "sunset", "graphite"])
  .openapi("AccentPalette");
export type AccentPalette = z.infer<typeof AccentPaletteSchema>;

export const UserRoleSchema = z.enum(["user", "admin"]).openapi("UserRole");
export type UserRole = z.infer<typeof UserRoleSchema>;

export const DashboardSectionIdSchema = z
  .enum([
    "analytics_kpis",
    "cashflow_trend",
    "category_breakdown",
    "accounts",
    "recent_operations",
  ])
  .openapi("DashboardSectionId");
export type DashboardSectionId = z.infer<typeof DashboardSectionIdSchema>;

export const DEFAULT_DASHBOARD_LAYOUT: readonly DashboardSectionId[] = [
  "analytics_kpis",
  "cashflow_trend",
  "category_breakdown",
  "accounts",
  "recent_operations",
] as const;

export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/)
  .openapi({ example: "RUB", description: "ISO 4217 3-letter currency code" });

export const IsoDateTimeSchema = z.iso
  .datetime({ offset: true })
  .openapi({ example: "2026-11-26T04:30:00.000Z" });

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
  .openapi({ example: "2026-11-26" });

export const PeriodKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM period key")
  .openapi({ example: "2026-11" });

export const MinorUnitsSchema = z
  .int()
  .openapi({ example: 15000, description: "Integer minor units (kopecks/cents)" });

export const PositiveMinorUnitsSchema = z
  .int()
  .positive()
  .openapi({ example: 15000, description: "Strictly positive integer minor units" });

export const NonNegativeMinorUnitsSchema = z
  .int()
  .nonnegative()
  .openapi({ example: 0, description: "Non-negative integer minor units" });

export const RateDecimalSchema = z
  .number()
  .min(0)
  .max(1)
  .openapi({ example: 0.16, description: "Annual interest rate as decimal (0.16 = 16%)" });

export const SyncFieldsSchema = z.object({
  id: z.uuid(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
});

export const WrappedSettingsSchema = z
  .object({
    coffeePriceMinor: PositiveMinorUnitsSchema.default(25000),
    shawarmaPriceMinor: PositiveMinorUnitsSchema.default(35000),
    subscriptionAvgMinor: PositiveMinorUnitsSchema.default(39900),
    workHoursPerMonth: z.int().positive().default(160),
    promoWarningDays: z.int().nonnegative().default(14),
  })
  .openapi("WrappedSettings");
export type WrappedSettings = z.infer<typeof WrappedSettingsSchema>;

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "INVITE_REQUIRED" }),
    message: z.string().openapi({ example: "An invite code is required" }),
    details: z.unknown().optional(),
  })
  .openapi("ErrorResponse");
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const HealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    app: z.literal("strata"),
    version: z.string(),
    timestamp: IsoDateTimeSchema,
    db: z.enum(["ok", "unconfigured", "error"]).optional(),
  })
  .openapi("HealthResponse");
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const EntityIdParamSchema = z.object({
  id: z.uuid().openapi({
    param: { name: "id", in: "path" },
    example: "11111111-1111-4111-8111-111111111111",
  }),
});

export const DeletedEntityResponseSchema = z
  .object({
    id: z.uuid(),
    deleted_at: IsoDateTimeSchema,
  })
  .openapi("DeletedEntityResponse");
export type DeletedEntityResponse = z.infer<typeof DeletedEntityResponseSchema>;
