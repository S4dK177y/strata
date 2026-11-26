import {
  IsoDateTimeSchema,
  PositiveMinorUnitsSchema,
  TransactionSourceSchema,
  TransactionStatusSchema,
  TransactionTypeSchema,
  type TransactionStatus,
  type TransactionType,
  z,
} from "./common";
import { TransactionSchema } from "./entities";

export function validateTransactionDomainRules(
  val: {
    type: TransactionType;
    status: TransactionStatus;
    account_from_id: string | null;
    account_to_id: string | null;
  },
  ctx: z.RefinementCtx
): void {
  if (val.type !== "transfer" && val.account_to_id !== null) {
    ctx.addIssue({
      code: "custom",
      message: "Only transfer transactions may set account_to_id",
      path: ["account_to_id"],
    });
  }

  if (val.status === "confirmed") {
    if (val.type === "transfer") {
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
    } else if (!val.account_from_id) {
      ctx.addIssue({
        code: "custom",
        message: "Confirmed transactions require account_from_id",
        path: ["account_from_id"],
      });
    }
  }
}

export const TransactionCreateRequestSchema = z
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
    comment: z.string().trim().max(1000).default(""),
    status: TransactionStatusSchema.default("confirmed"),
    source: TransactionSourceSchema.default("web"),
    external_hash: z.string().trim().min(1).max(255).nullable().default(null),
  })
  .superRefine(validateTransactionDomainRules)
  .openapi("TransactionCreateRequest");
export type TransactionCreateRequest = z.infer<typeof TransactionCreateRequestSchema>;

export const TransactionUpdateRequestSchema = z
  .object({
    occurred_at: IsoDateTimeSchema.optional(),
    type: TransactionTypeSchema.optional(),
    amount_minor: PositiveMinorUnitsSchema.optional(),
    category_id: z.uuid().nullable().optional(),
    account_from_id: z.uuid().nullable().optional(),
    account_to_id: z.uuid().nullable().optional(),
    goal_id: z.uuid().nullable().optional(),
    debt_id: z.uuid().nullable().optional(),
    recurring_payment_id: z.uuid().nullable().optional(),
    comment: z.string().trim().max(1000).optional(),
    status: TransactionStatusSchema.optional(),
    external_hash: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("TransactionUpdateRequest");
export type TransactionUpdateRequest = z.infer<typeof TransactionUpdateRequestSchema>;

export const TransactionsListQuerySchema = z.object({
  from: IsoDateTimeSchema.optional().openapi({
    param: { name: "from", in: "query", required: false },
    description: "Inclusive start occurred_at timestamp (ISO-8601)",
  }),
  to: IsoDateTimeSchema.optional().openapi({
    param: { name: "to", in: "query", required: false },
    description: "Inclusive end occurred_at timestamp (ISO-8601)",
  }),
  type: TransactionTypeSchema.optional().openapi({
    param: { name: "type", in: "query", required: false },
  }),
  account_id: z.uuid().optional().openapi({
    param: { name: "account_id", in: "query", required: false },
    description: "Matches either account_from_id or account_to_id",
  }),
  category_id: z.uuid().optional().openapi({
    param: { name: "category_id", in: "query", required: false },
  }),
  status: TransactionStatusSchema.optional().openapi({
    param: { name: "status", in: "query", required: false },
  }),
  search: z.string().trim().max(120).optional().openapi({
    param: { name: "search", in: "query", required: false },
    description: "Case-insensitive substring search in comment",
  }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .openapi({
      param: { name: "limit", in: "query", required: false },
    }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({
      param: { name: "offset", in: "query", required: false },
    }),
});
export type TransactionsListQuery = z.infer<typeof TransactionsListQuerySchema>;

export const TransactionResponseSchema = z
  .object({
    transaction: TransactionSchema,
  })
  .openapi("TransactionResponse");
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

export const TransactionsListResponseSchema = z
  .object({
    transactions: z.array(TransactionSchema),
    total: z.int().nonnegative(),
    has_more: z.boolean(),
  })
  .openapi("TransactionsListResponse");
export type TransactionsListResponse = z.infer<typeof TransactionsListResponseSchema>;
