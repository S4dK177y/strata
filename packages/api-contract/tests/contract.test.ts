import { describe, expect, it } from "vitest";
import {
  AccountCreateRequestSchema,
  ActiveSessionSchema,
  CategoryCreateRequestSchema,
  DeleteAccountRequestSchema,
  HealthResponseSchema,
  MeResponseSchema,
  OnboardingCompleteRequestSchema,
  ProfileUpdateRequestSchema,
  RedeemInviteRequestSchema,
  SessionListResponseSchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  TransactionCreateRequestSchema,
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

  it("validates PR 4 Account, Category, and Transaction CRUD schemas & domain invariants", () => {
    expect(
      AccountCreateRequestSchema.safeParse({
        name: "Credit Card",
        type: "credit",
        currency: "RUB",
        initial_balance_minor: -1500000,
        credit_limit_minor: 10000000,
      }).success
    ).toBe(true);

    expect(
      CategoryCreateRequestSchema.safeParse({
        name: "Invalid Expense",
        kind: "expense",
        is_passive: true,
      }).success
    ).toBe(false);

    expect(
      CategoryCreateRequestSchema.safeParse({
        name: "Cashback",
        kind: "income",
        is_passive: true,
      }).success
    ).toBe(true);

    expect(
      TransactionCreateRequestSchema.safeParse({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "expense",
        amount_minor: 50000,
        account_from_id: null,
        status: "confirmed",
      }).success
    ).toBe(false);

    expect(
      TransactionCreateRequestSchema.safeParse({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "expense",
        amount_minor: 50000,
        account_from_id: null,
        status: "draft",
      }).success
    ).toBe(true);

    expect(
      TransactionCreateRequestSchema.safeParse({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "expense",
        amount_minor: 50000,
        account_from_id: UUID_1,
        account_to_id: UUID_2,
        status: "confirmed",
      }).success
    ).toBe(false);

    expect(
      TransactionCreateRequestSchema.safeParse({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "transfer",
        amount_minor: 50000,
        account_from_id: UUID_1,
        account_to_id: UUID_1,
        status: "confirmed",
      }).success
    ).toBe(false);

    expect(
      TransactionCreateRequestSchema.safeParse({
        occurred_at: "2026-11-26T12:00:00.000Z",
        type: "transfer",
        amount_minor: 50000,
        account_from_id: UUID_1,
        account_to_id: UUID_2,
        status: "confirmed",
      }).success
    ).toBe(true);
  });

  it("validates PR 5 security schemas (sessions, account deletion, MeResponse defaults)", () => {
    const session = ActiveSessionSchema.parse({
      id: UUID_1,
      is_current: true,
      device_type: "desktop",
      device_label: "Chrome · Linux",
      browser: "Chrome 131",
      os: "Linux",
      ip: "203.0.113.42",
      aal: "aal2",
      created_at: "2026-11-26T10:00:00.000Z",
      last_active_at: "2026-11-26T12:00:00.000Z",
      not_after: null,
    });
    expect(session.is_current).toBe(true);

    const sessionList = SessionListResponseSchema.parse({
      sessions: [session],
      current_session_id: UUID_1,
    });
    expect(sessionList.sessions).toHaveLength(1);

    expect(
      DeleteAccountRequestSchema.safeParse({ password: "" }).success
    ).toBe(false);
    expect(
      DeleteAccountRequestSchema.safeParse({ password: "my-secret-password" }).success
    ).toBe(true);
    expect(
      DeleteAccountRequestSchema.safeParse({
        password: "my-secret-password",
        totp_code: " 123456 ",
      }).success
    ).toBe(true);
    expect(
      DeleteAccountRequestSchema.safeParse({
        password: "my-secret-password",
        totp_code: "12ab56",
      }).success
    ).toBe(false);

    const me = MeResponseSchema.parse({
      profile: {
        id: UUID_1,
        role: "user",
        display_name: "Alex",
        locale: "ru",
        base_currency: "RUB",
        theme: "dark",
        privacy_blur_default: false,
        onboarding_completed: true,
        invite_redeemed_at: "2026-11-26T10:00:00.000Z",
        wrapped_settings: {},
        created_at: "2026-11-26T10:00:00.000Z",
        updated_at: "2026-11-26T10:00:00.000Z",
      },
      email: "alex@example.com",
      invite_required: false,
    });
    expect(me.aal).toBe("aal1");
    expect(me.mfa_enabled).toBe(false);
    expect(me.mfa_required).toBe(false);
  });
});
