import { isConfirmedActiveTx } from "./balances";
import { getEffectiveRate } from "./savings";
import type { Account, Goal, GoalTransfer, SavingsRule, Transaction } from "./types";

export interface GoalEnvelopeResult {
  goalId: string;
  name: string;
  fromTransactionsMinor: number;
  fromGoalTransfersMinor: number;
  currentMinor: number;
  remainingMinor: number;
  progress: number;
  isAchieved: boolean;
  monthsToGoal: number | null;
  estimatedYearMonth: string | null;
}

function isSavingsAccount(account: Account | undefined): boolean {
  return account?.type === "savings" || account?.type === "deposit";
}

function addMonthsToDate(asOfDate: string, months: number): string {
  const [yStr, mStr] = asOfDate.slice(0, 10).split("-");
  const baseYear = Number(yStr ?? 2026);
  const baseMonth = Number(mStr ?? 1) - 1;
  const totalMonths = baseYear * 12 + baseMonth + months;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function computeNperMonths(
  annualRate: number,
  monthlyContributionMinor: number,
  currentMinor: number,
  targetMinor: number,
): number | null {
  if (targetMinor <= 0) return null;
  if (currentMinor >= targetMinor) return 0;

  const pmt = Math.max(0, monthlyContributionMinor);
  const pv = Math.max(0, currentMinor);
  const fv = targetMinor;
  const r = annualRate > 0 ? annualRate / 12 : 0;

  if (r <= 0) {
    if (pmt <= 0) return null;
    return Math.ceil((fv - pv) / pmt);
  }

  if (pmt <= 0 && pv <= 0) {
    return null;
  }

  const numerator = pmt + fv * r;
  const denominator = pmt + pv * r;
  if (numerator <= 0 || denominator <= 0) return null;

  const nper = Math.log(numerator / denominator) / Math.log(1 + r);
  if (!Number.isFinite(nper) || nper < 0) return null;

  return Math.ceil(nper);
}

export function computeGoalEnvelope(
  goal: Goal,
  accounts: Account[],
  savingsRules: SavingsRule[],
  transactions: Transaction[],
  goalTransfers: GoalTransfer[],
  asOfDate: string,
): GoalEnvelopeResult {
  const accountMap = new Map(accounts.filter((a) => !a.deletedAt).map((a) => [a.id, a]));
  const ruleMap = new Map(
    savingsRules.filter((r) => !r.deletedAt).map((r) => [r.accountId, r]),
  );

  let fromTransactionsMinor = 0;

  for (const tx of transactions) {
    if (!isConfirmedActiveTx(tx) || tx.goalId !== goal.id) continue;

    if (tx.type === "expense") {
      fromTransactionsMinor -= tx.amountMinor;
    } else if (tx.type === "income" || tx.type === "passive_income") {
      fromTransactionsMinor += tx.amountMinor;
    } else if (tx.type === "transfer") {
      const fromAcc = tx.accountFromId ? accountMap.get(tx.accountFromId) : undefined;
      const toAcc = tx.accountToId ? accountMap.get(tx.accountToId) : undefined;
      const fromSav = isSavingsAccount(fromAcc);
      const toSav = isSavingsAccount(toAcc);

      // Moving money between two savings accounts preserves envelope balance
      if (toSav && !fromSav) {
        fromTransactionsMinor += tx.amountMinor;
      } else if (fromSav && !toSav) {
        fromTransactionsMinor -= tx.amountMinor;
      }
    }
  }

  let fromGoalTransfersMinor = 0;
  for (const gt of goalTransfers) {
    if (gt.deletedAt) continue;
    if (gt.toGoalId === goal.id) fromGoalTransfersMinor += gt.amountMinor;
    if (gt.fromGoalId === goal.id) fromGoalTransfersMinor -= gt.amountMinor;
  }

  const currentMinor = Math.max(
    0,
    goal.initialAmountMinor + fromTransactionsMinor + fromGoalTransfersMinor,
  );
  const remainingMinor = Math.max(0, goal.targetAmountMinor - currentMinor);
  const progress = goal.targetAmountMinor <= 0 ? 0 : Math.min(1, currentMinor / goal.targetAmountMinor);
  const isAchieved = goal.targetAmountMinor > 0 && currentMinor >= goal.targetAmountMinor;

  const storageRule = goal.storageAccountId ? ruleMap.get(goal.storageAccountId) : undefined;
  const effectiveRate = storageRule ? getEffectiveRate(storageRule, asOfDate) : 0;

  const monthsToGoal = computeNperMonths(
    effectiveRate,
    goal.monthlyPlanMinor,
    currentMinor,
    goal.targetAmountMinor,
  );

  const estimatedYearMonth =
    monthsToGoal !== null ? addMonthsToDate(asOfDate, monthsToGoal) : null;

  return {
    goalId: goal.id,
    name: goal.name,
    fromTransactionsMinor,
    fromGoalTransfersMinor,
    currentMinor,
    remainingMinor,
    progress,
    isAchieved,
    monthsToGoal,
    estimatedYearMonth,
  };
}
