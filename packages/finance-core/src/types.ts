export type AccountType = "debit" | "credit" | "cash" | "savings" | "deposit";

export type TransactionType =
  | "expense"
  | "income"
  | "passive_income"
  | "transfer"
  | "compensation"
  | "transit_in"
  | "transit_out"
  | "debt_given"
  | "debt_received_back"
  | "debt_borrowed"
  | "debt_paid_back";

export type DebtDirection = "lent" | "borrowed";
export type SavingsAccrualType = "daily_balance" | "min_balance";
export type GoalPriority = "high" | "medium" | "low";
export type RecurringCadence = "weekly" | "monthly" | "quarterly" | "yearly";
export type TransactionStatus = "confirmed" | "draft";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceMinor: number;
  creditLimitMinor: number;
  isActive: boolean;
  deletedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  kind: "expense" | "income";
  isPassive: boolean;
  monthlyLimitMinor: number | null;
  deletedAt?: string | null;
}

export interface Transaction {
  id: string;
  occurredAt: string; // YYYY-MM-DD or ISO timestamp
  type: TransactionType;
  amountMinor: number; // strictly > 0
  categoryId: string | null;
  accountFromId: string | null;
  accountToId: string | null;
  goalId: string | null;
  debtId?: string | null;
  recurringPaymentId?: string | null;
  comment: string;
  status: TransactionStatus;
  deletedAt?: string | null;
}

export interface SavingsRule {
  id: string;
  accountId: string;
  accrualType: SavingsAccrualType;
  baseRate: number; // decimal e.g. 0.10 for 10%
  promoRate: number; // decimal e.g. 0.16 for 16%
  promoEndDate: string | null; // YYYY-MM-DD
  capitalization: boolean;
  minBalanceOverrideMinor: number | null;
  deletedAt?: string | null;
}

export interface Goal {
  id: string;
  name: string;
  priority: GoalPriority;
  targetAmountMinor: number;
  initialAmountMinor: number;
  monthlyPlanMinor: number;
  storageAccountId: string | null;
  isArchived?: boolean;
  deletedAt?: string | null;
}

export interface GoalTransfer {
  id: string;
  fromGoalId: string;
  toGoalId: string;
  amountMinor: number;
  occurredAt: string;
  deletedAt?: string | null;
}

export interface Debt {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  amountMinor: number;
  manualRepaidMinor: number;
  openedAt: string; // YYYY-MM-DD
  deletedAt?: string | null;
}

export interface RecurringPayment {
  id: string;
  name: string;
  categoryId: string | null;
  accountId: string | null;
  amountMinor: number;
  dayOfMonth: number;
  cadence: RecurringCadence;
  matchKeyword: string | null;
  isActive: boolean;
  deletedAt?: string | null;
}

export interface RecurringPaymentMark {
  id: string;
  recurringPaymentId: string;
  periodKey: string; // YYYY-MM
  markedAt: string;
  deletedAt?: string | null;
}

export interface WrappedSettings {
  coffeePriceMinor: number;
  shawarmaPriceMinor: number;
  subscriptionAvgMinor: number;
  workHoursPerMonth: number;
  promoWarningDays: number;
}
