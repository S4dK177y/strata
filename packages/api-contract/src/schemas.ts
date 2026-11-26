import { z } from "zod";

export const AccountTypeSchema = z.enum(["debit", "credit", "cash", "savings", "deposit"]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const TransactionTypeSchema = z.enum([
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
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const DebtDirectionSchema = z.enum(["lent", "borrowed"]);
export type DebtDirection = z.infer<typeof DebtDirectionSchema>;

export const TransactionStatusSchema = z.enum(["confirmed", "draft"]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionSourceSchema = z.enum([
  "web",
  "android",
  "android_push",
  "import_xlsx",
  "import_csv",
]);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const LocaleSchema = z.enum(["ru", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const ThemeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const SyncFieldsSchema = z.object({
  id: z.uuid(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  deleted_at: z.iso.datetime().nullable(),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  app: z.literal("strata"),
  version: z.string(),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const FeatureFlagSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  starts_at: z.iso.datetime().nullable(),
  ends_at: z.iso.datetime().nullable(),
  admin_preview: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  updated_at: z.iso.datetime(),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
