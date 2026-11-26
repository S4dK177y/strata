import type {
  Account as ApiAccount,
  Category as ApiCategory,
  Debt as ApiDebt,
  Transaction as ApiTransaction,
} from "@strata/api-contract";
import type {
  Account as CoreAccount,
  Category as CoreCategory,
  Debt as CoreDebt,
  Transaction as CoreTransaction,
} from "@strata/finance-core";

export function toCoreAccount(row: ApiAccount): CoreAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalanceMinor: row.initial_balance_minor,
    creditLimitMinor: row.credit_limit_minor,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
  };
}

export function toCoreCategory(row: ApiCategory): CoreCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    isPassive: row.is_passive,
    monthlyLimitMinor: row.monthly_limit_minor,
    deletedAt: row.deleted_at,
  };
}

export function toCoreTransaction(row: ApiTransaction): CoreTransaction {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    type: row.type,
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    accountFromId: row.account_from_id,
    accountToId: row.account_to_id,
    goalId: row.goal_id,
    debtId: row.debt_id,
    comment: row.comment,
    status: row.status,
    deletedAt: row.deleted_at,
  };
}

export function toCoreDebt(row: ApiDebt): CoreDebt {
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    amountMinor: row.amount_minor,
    manualRepaidMinor: row.manual_repaid_minor,
    openedAt: row.opened_at,
    deletedAt: row.deleted_at,
  };
}
