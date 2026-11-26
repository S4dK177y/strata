import {
  AccountTypeSchema,
  CategoryKindSchema,
  CurrencyCodeSchema,
  DebtDirectionSchema,
  GoalPrioritySchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  MinorUnitsSchema,
  NonNegativeMinorUnitsSchema,
  PeriodKeySchema,
  PositiveMinorUnitsSchema,
  RateDecimalSchema,
  RecurringCadenceSchema,
  SavingsAccrualTypeSchema,
  TransactionSourceSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
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

export const SYNC_ENTITY_ORDER = [
  "accounts",
  "savings_rules",
  "categories",
  "goals",
  "debts",
  "recurring_payments",
  "goal_transfers",
  "recurring_payment_marks",
  "transactions",
] as const;

export const SyncEntityNameSchema = z.enum(SYNC_ENTITY_ORDER).openapi("SyncEntityName");
export type SyncEntityName = z.infer<typeof SyncEntityNameSchema>;

export const SyncPullQuerySchema = z.object({
  since: IsoDateTimeSchema.optional().openapi({
    param: { name: "since", in: "query", required: false },
    description: "ISO-8601 timestamp cursor for incremental delta pull (updated_at >= since)",
    example: "2026-11-01T00:00:00.000Z",
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(500)
    .openapi({
      param: { name: "limit", in: "query", required: false },
      description: "Max rows returned per entity table (1..1000)",
      example: 500,
    }),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

export const SyncChangesBundleSchema = z
  .object({
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
  .openapi("SyncChangesBundle");
export type SyncChangesBundle = z.infer<typeof SyncChangesBundleSchema>;

export const SyncPullResponseSchema = z
  .object({
    server_time: IsoDateTimeSchema,
    since: IsoDateTimeSchema.nullable(),
    has_more: z.boolean(),
    changes: SyncChangesBundleSchema,
  })
  .openapi("SyncPullResponse");
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;

export const AccountUpsertPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: AccountTypeSchema,
  currency: CurrencyCodeSchema.default("RUB"),
  initial_balance_minor: MinorUnitsSchema.default(0),
  credit_limit_minor: NonNegativeMinorUnitsSchema.default(0),
  bank_name: z.string().max(120).nullable().default(null),
  last4_digits: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .default(null),
  is_active: z.boolean().default(true),
  sort_order: z.int().default(0),
  created_at: IsoDateTimeSchema.optional(),
});

export const SavingsRuleUpsertPayloadSchema = z.object({
  account_id: z.uuid(),
  accrual_type: SavingsAccrualTypeSchema.default("daily_balance"),
  base_rate: RateDecimalSchema.default(0),
  promo_rate: RateDecimalSchema.default(0),
  promo_end_date: IsoDateSchema.nullable().default(null),
  capitalization: z.boolean().default(true),
  min_balance_override_minor: NonNegativeMinorUnitsSchema.nullable().default(null),
  created_at: IsoDateTimeSchema.optional(),
});

export const CategoryUpsertPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: CategoryKindSchema,
  is_passive: z.boolean().default(false),
  monthly_limit_minor: NonNegativeMinorUnitsSchema.nullable().default(null),
  icon: z.string().max(64).nullable().default(null),
  color: z.string().max(64).nullable().default(null),
  hint: z.string().max(240).nullable().default(null),
  sort_order: z.int().default(0),
  created_at: IsoDateTimeSchema.optional(),
});

export const GoalUpsertPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  priority: GoalPrioritySchema.default("medium"),
  target_amount_minor: PositiveMinorUnitsSchema,
  initial_amount_minor: NonNegativeMinorUnitsSchema.default(0),
  monthly_plan_minor: NonNegativeMinorUnitsSchema.default(0),
  storage_account_id: z.uuid().nullable().default(null),
  is_archived: z.boolean().default(false),
  sort_order: z.int().default(0),
  created_at: IsoDateTimeSchema.optional(),
});

export const GoalTransferUpsertPayloadSchema = z
  .object({
    from_goal_id: z.uuid(),
    to_goal_id: z.uuid(),
    amount_minor: PositiveMinorUnitsSchema,
    occurred_at: IsoDateTimeSchema,
    comment: z.string().max(500).default(""),
    created_at: IsoDateTimeSchema.optional(),
  })
  .refine((v) => v.from_goal_id !== v.to_goal_id, {
    message: "from_goal_id and to_goal_id must be distinct",
    path: ["to_goal_id"],
  });

export const RecurringPaymentUpsertPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category_id: z.uuid().nullable().default(null),
  account_id: z.uuid().nullable().default(null),
  amount_minor: PositiveMinorUnitsSchema,
  day_of_month: z.int().min(1).max(31),
  cadence: RecurringCadenceSchema.default("monthly"),
  match_keyword: z.string().max(120).nullable().default(null),
  is_active: z.boolean().default(true),
  created_at: IsoDateTimeSchema.optional(),
});

export const RecurringPaymentMarkUpsertPayloadSchema = z.object({
  recurring_payment_id: z.uuid(),
  period_key: PeriodKeySchema,
  marked_at: IsoDateTimeSchema.optional(),
  created_at: IsoDateTimeSchema.optional(),
});

export const DebtUpsertPayloadSchema = z.object({
  direction: DebtDirectionSchema,
  counterparty: z.string().trim().min(1).max(120),
  amount_minor: PositiveMinorUnitsSchema,
  manual_repaid_minor: NonNegativeMinorUnitsSchema.default(0),
  opened_at: IsoDateSchema,
  due_date: IsoDateSchema.nullable().default(null),
  comment: z.string().max(500).default(""),
  created_at: IsoDateTimeSchema.optional(),
});

export const TransactionUpsertPayloadSchema = z
  .object({
    occurred_at: IsoDateTimeSchema,
    type: TransactionTypeSchema,
    amount_minor: PositiveMinorUnitsSchema,
    category_id: z.uuid().nullable().default(null),
    account_from_id: z.uuid().nullable().default(null),
    account_to_id: z.uuid().nullable().default(null),
    goal_id: z.uuid().nullable().default(null),
    debt_id: z.uuid().nullable().default(null),
    recurring_payment_id: z.uuid().nullable().default(null),
    comment: z.string().max(1000).default(""),
    status: TransactionStatusSchema.default("confirmed"),
    source: TransactionSourceSchema.default("web"),
    external_hash: z.string().min(1).max(255).nullable().default(null),
    created_at: IsoDateTimeSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "confirmed" && val.type === "transfer") {
      if (!val.account_from_id || !val.account_to_id) {
        ctx.addIssue({
          code: "custom",
          message: "Confirmed transfers require both account_from_id and account_to_id",
          path: ["account_to_id"],
        });
      } else if (val.account_from_id === val.account_to_id) {
        ctx.addIssue({
          code: "custom",
          message: "Transfer source and destination accounts must differ",
          path: ["account_to_id"],
        });
      }
    }
  });

export const SyncUpsertMutationSchema = z
  .discriminatedUnion("entity", [
    z.object({
      entity: z.literal("accounts"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: AccountUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("savings_rules"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: SavingsRuleUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("categories"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: CategoryUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("goals"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: GoalUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("goal_transfers"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: GoalTransferUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("recurring_payments"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: RecurringPaymentUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("recurring_payment_marks"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: RecurringPaymentMarkUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("debts"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: DebtUpsertPayloadSchema,
    }),
    z.object({
      entity: z.literal("transactions"),
      operation: z.literal("upsert"),
      id: z.uuid(),
      updated_at: IsoDateTimeSchema,
      payload: TransactionUpsertPayloadSchema,
    }),
  ])
  .openapi("SyncUpsertMutation");

export const SyncDeleteMutationSchema = z
  .object({
    entity: SyncEntityNameSchema,
    operation: z.literal("delete"),
    id: z.uuid(),
    updated_at: IsoDateTimeSchema,
  })
  .openapi("SyncDeleteMutation");

export const SyncMutationSchema = z
  .union([SyncUpsertMutationSchema, SyncDeleteMutationSchema])
  .openapi("SyncMutation");
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncPushRequestSchema = z
  .object({
    mutations: z.array(SyncMutationSchema).min(1).max(500),
  })
  .openapi("SyncPushRequest");
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPushResultStatusSchema = z
  .enum(["applied", "conflict_server_wins", "rejected"])
  .openapi("SyncPushResultStatus");

export const SyncPushResultItemSchema = z
  .object({
    entity: SyncEntityNameSchema,
    id: z.uuid(),
    status: SyncPushResultStatusSchema,
    server_updated_at: IsoDateTimeSchema.optional(),
    reason: z.string().optional(),
  })
  .openapi("SyncPushResultItem");
export type SyncPushResultItem = z.infer<typeof SyncPushResultItemSchema>;

export const SyncPushResponseSchema = z
  .object({
    server_time: IsoDateTimeSchema,
    results: z.array(SyncPushResultItemSchema),
  })
  .openapi("SyncPushResponse");
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
