import { describe, expect, it } from "vitest";
import {
  HealthResponseSchema,
  OnboardingCompleteRequestSchema,
  ProfileUpdateRequestSchema,
  RedeemInviteRequestSchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  TransactionSourceSchema,
  TransactionTypeSchema,
} from "../src/index";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";
const UUID_3 = "33333333-3333-4333-8333-333333333333";

describe("@strata/api-contract", () => {
  it("supports all 11 transaction types and excludes CSV/XLSX import sources", () => {
    expect(TransactionTypeSchema.options).toHaveLength(11);
    expect(TransactionSourceSchema.options).toEqual(["web", "android", "android_push"]);
    expect(TransactionSourceSchema.safeParse("import_csv").success).toBe(false);
    expect(TransactionSourceSchema.safeParse("import_xlsx").success).toBe(false);
  });

  it("validates HealthResponseSchema with optional db status", () => {
    const parsed = HealthResponseSchema.parse({
      status: "ok",
      app: "strata",
      version: "0.1.0",
      timestamp: "2026-11-26T04:30:00+00:00",
      db: "ok",
    });

    expect(parsed.db).toBe("ok");
  });

  it("enforces strictly positive integer minor units on transactions in SyncPushRequestSchema", () => {
    const valid = SyncPushRequestSchema.safeParse({
      mutations: [
        {
          entity: "transactions",
          operation: "upsert",
          id: UUID_1,
          updated_at: "2026-11-26T04:30:00Z",
          payload: {
            occurred_at: "2026-11-26T04:29:00Z",
            type: "expense",
            amount_minor: 15000,
            account_from_id: UUID_2,
            source: "web",
          },
        },
        {
          entity: "accounts",
          operation: "delete",
          id: UUID_3,
          updated_at: "2026-11-26T04:31:00Z",
        },
      ],
    });
    expect(valid.success).toBe(true);

    const zeroAmount = SyncPushRequestSchema.safeParse({
      mutations: [
        {
          entity: "transactions",
          operation: "upsert",
          id: UUID_1,
          updated_at: "2026-11-26T04:30:00Z",
          payload: {
            occurred_at: "2026-11-26T04:29:00Z",
            type: "expense",
            amount_minor: 0,
          },
        },
      ],
    });
    expect(zeroAmount.success).toBe(false);

    const floatAmount = SyncPushRequestSchema.safeParse({
      mutations: [
        {
          entity: "transactions",
          operation: "upsert",
          id: UUID_1,
          updated_at: "2026-11-26T04:30:00Z",
          payload: {
            occurred_at: "2026-11-26T04:29:00Z",
            type: "expense",
            amount_minor: 150.5,
          },
        },
      ],
    });
    expect(floatAmount.success).toBe(false);
  });

  it("rejects confirmed transfers with identical or missing accounts", () => {
    const sameAccount = SyncPushRequestSchema.safeParse({
      mutations: [
        {
          entity: "transactions",
          operation: "upsert",
          id: UUID_1,
          updated_at: "2026-11-26T04:30:00Z",
          payload: {
            occurred_at: "2026-11-26T04:29:00Z",
            type: "transfer",
            amount_minor: 50000,
            account_from_id: UUID_2,
            account_to_id: UUID_2,
            status: "confirmed",
          },
        },
      ],
    });
    expect(sameAccount.success).toBe(false);

    const draftTransferWithoutAccounts = SyncPushRequestSchema.safeParse({
      mutations: [
        {
          entity: "transactions",
          operation: "upsert",
          id: UUID_1,
          updated_at: "2026-11-26T04:30:00Z",
          payload: {
            occurred_at: "2026-11-26T04:29:00Z",
            type: "transfer",
            amount_minor: 50000,
            status: "draft",
            source: "android_push",
          },
        },
      ],
    });
    expect(draftTransferWithoutAccounts.success).toBe(true);
  });

  it("validates SyncPullResponseSchema bundle shape", () => {
    const parsed = SyncPullResponseSchema.parse({
      server_time: "2026-11-26T04:30:00Z",
      since: null,
      has_more: false,
      changes: {
        accounts: [],
        savings_rules: [],
        categories: [],
        goals: [],
        goal_transfers: [],
        recurring_payments: [],
        recurring_payment_marks: [],
        debts: [],
        transactions: [],
      },
    });
    expect(parsed.has_more).toBe(false);
  });

  it("validates ProfileUpdateRequestSchema, RedeemInviteRequestSchema, and OnboardingCompleteRequestSchema", () => {
    expect(ProfileUpdateRequestSchema.safeParse({}).success).toBe(false);
    expect(
      ProfileUpdateRequestSchema.safeParse({
        theme: "dark",
        locale: "en",
        privacy_blur_default: true,
      }).success
    ).toBe(true);

    expect(RedeemInviteRequestSchema.safeParse({ code: " ab " }).success).toBe(false);
    const inviteParsed = RedeemInviteRequestSchema.parse({ code: "  STRATA-2026  " });
    expect(inviteParsed.code).toBe("STRATA-2026");

    const onboardingValid = OnboardingCompleteRequestSchema.safeParse({
      display_name: "Alex",
      locale: "ru",
      base_currency: "RUB",
      theme: "system",
      privacy_blur_default: false,
      accounts: [
        {
          name: "Main Debit",
          type: "debit",
          currency: "RUB",
          initial_balance_minor: 500000,
        },
      ],
      categories: [
        {
          name: "Groceries",
          kind: "expense",
          is_passive: false,
        },
      ],
    });
    expect(onboardingValid.success).toBe(true);

    const onboardingFloat = OnboardingCompleteRequestSchema.safeParse({
      locale: "en",
      base_currency: "USD",
      theme: "dark",
      accounts: [
        {
          name: "Checking",
          type: "debit",
          currency: "USD",
          initial_balance_minor: 12.34,
        },
      ],
    });
    expect(onboardingFloat.success).toBe(false);
  });
});
