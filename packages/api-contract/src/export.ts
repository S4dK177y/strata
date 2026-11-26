import {
  AccentPaletteSchema,
  CurrencyCodeSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  ThemeSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  WrappedSettingsSchema,
  z,
} from "./common";
import {
  AccountSchema,
  CategorySchema,
  DebtSchema,
  GoalSchema,
  GoalTransferSchema,
  RecurringPaymentMarkSchema,
  RecurringPaymentSchema,
  SavingsRuleSchema,
  TransactionSchema,
} from "./entities";

export const ExportJsonQuerySchema = z.object({
  include_deleted: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "include_deleted", in: "query" } }),
});
export type ExportJsonQuery = z.infer<typeof ExportJsonQuerySchema>;

export const ExportProfileSnapshotSchema = z
  .object({
    display_name: z.string(),
    locale: LocaleSchema,
    base_currency: CurrencyCodeSchema,
    theme: ThemeSchema,
    accent: AccentPaletteSchema,
    privacy_blur_default: z.boolean(),
    wrapped_settings: WrappedSettingsSchema,
  })
  .openapi("ExportProfileSnapshot");
export type ExportProfileSnapshot = z.infer<typeof ExportProfileSnapshotSchema>;

export const ExportJsonResponseSchema = z
  .object({
    schema_version: z.literal("1.0"),
    exported_at: IsoDateTimeSchema,
    profile: ExportProfileSnapshotSchema,
    accounts: z.array(AccountSchema),
    savings_rules: z.array(SavingsRuleSchema),
    categories: z.array(CategorySchema),
    goals: z.array(GoalSchema),
    goal_transfers: z.array(GoalTransferSchema),
    recurring_payments: z.array(RecurringPaymentSchema),
    recurring_payment_marks: z.array(RecurringPaymentMarkSchema),
    debts: z.array(DebtSchema),
    transactions: z.array(TransactionSchema),
  })
  .openapi("ExportJsonResponse");
export type ExportJsonResponse = z.infer<typeof ExportJsonResponseSchema>;

export const ExportCsvQuerySchema = z.object({
  from: IsoDateTimeSchema.optional().openapi({ param: { name: "from", in: "query" } }),
  to: IsoDateTimeSchema.optional().openapi({ param: { name: "to", in: "query" } }),
  account_id: z.uuid().optional().openapi({ param: { name: "account_id", in: "query" } }),
  category_id: z.uuid().optional().openapi({ param: { name: "category_id", in: "query" } }),
  type: TransactionTypeSchema.optional().openapi({ param: { name: "type", in: "query" } }),
  status: TransactionStatusSchema.optional().openapi({ param: { name: "status", in: "query" } }),
});
export type ExportCsvQuery = z.infer<typeof ExportCsvQuerySchema>;
