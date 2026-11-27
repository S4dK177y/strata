import type {
  Account as ApiAccount,
  Category as ApiCategory,
  Debt as ApiDebt,
  Goal as ApiGoal,
  GoalTransfer as ApiGoalTransfer,
  RecurringPayment as ApiRecurringPayment,
  RecurringPaymentMark as ApiRecurringPaymentMark,
  SavingsRule as ApiSavingsRule,
  Transaction as ApiTransaction,
} from "@strata/api-contract";
import type {
  Account as CoreAccount,
  Category as CoreCategory,
  Debt as CoreDebt,
  Goal as CoreGoal,
  GoalTransfer as CoreGoalTransfer,
  RecurringPayment as CoreRecurringPayment,
  RecurringPaymentMark as CoreRecurringPaymentMark,
  SavingsRule as CoreSavingsRule,
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
    recurringPaymentId: row.recurring_payment_id,
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
    dueDate: row.due_date,
    comment: row.comment,
    deletedAt: row.deleted_at,
  };
}

export function toCoreGoal(row: ApiGoal): CoreGoal {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    targetAmountMinor: row.target_amount_minor,
    initialAmountMinor: row.initial_amount_minor,
    monthlyPlanMinor: row.monthly_plan_minor,
    storageAccountId: row.storage_account_id,
    isArchived: row.is_archived,
    sortOrder: row.sort_order,
    deletedAt: row.deleted_at,
  };
}

export function toCoreGoalTransfer(row: ApiGoalTransfer): CoreGoalTransfer {
  return {
    id: row.id,
    fromGoalId: row.from_goal_id,
    toGoalId: row.to_goal_id,
    amountMinor: row.amount_minor,
    occurredAt: row.occurred_at,
    deletedAt: row.deleted_at,
  };
}

export function toCoreSavingsRule(row: ApiSavingsRule): CoreSavingsRule {
  return {
    id: row.id,
    accountId: row.account_id,
    accrualType: row.accrual_type,
    baseRate: Number(row.base_rate),
    promoRate: Number(row.promo_rate),
    promoEndDate: row.promo_end_date,
    capitalization: row.capitalization,
    minBalanceOverrideMinor: row.min_balance_override_minor,
    deletedAt: row.deleted_at,
  };
}

export function toCoreRecurringPayment(row: ApiRecurringPayment): CoreRecurringPayment {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    accountId: row.account_id,
    amountMinor: row.amount_minor,
    dayOfMonth: row.day_of_month,
    cadence: row.cadence,
    matchKeyword: row.match_keyword,
    isActive: row.is_active,
    deletedAt: row.deleted_at,
  };
}

export function toCoreRecurringPaymentMark(
  row: ApiRecurringPaymentMark
): CoreRecurringPaymentMark {
  return {
    id: row.id,
    recurringPaymentId: row.recurring_payment_id,
    periodKey: row.period_key,
    markedAt: row.marked_at,
    deletedAt: row.deleted_at,
  };
}
