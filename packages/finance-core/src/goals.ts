import { isConfirmedActiveTx } from "./balances";
import { getEffectiveRate } from "./savings";
import type { Account, Goal, GoalPriority, GoalTransfer, SavingsRule, Transaction } from "./types";

export interface GoalEnvelopeResult {
  goalId: string;
  name: string;
  fromTransactionsMinor: number;
  fromGoalTransfersMinor: number;
  currentMinor: number;
  remainingMinor: number;
  progress: number;
  isAchieved: boolean;
  effectiveRate: number;
  monthsToGoal: number | null;
  estimatedYearMonth: string | null;
}

export interface GoalPortfolioItem {
  goal: Goal;
  envelope: GoalEnvelopeResult;
  storageAccount: Account | null;
}

export interface StorageAccountAllocation {
  accountId: string;
  accountName: string;
  accountBalanceMinor: number;
  allocatedMinor: number;
  freeMinor: number;
}

export interface GoalsPortfolioSummary {
  activeItems: GoalPortfolioItem[];
  archivedItems: GoalPortfolioItem[];
  totalSavedMinor: number;
  totalTargetMinor: number;
  totalRemainingMinor: number;
  totalMonthlyPlanMinor: number;
  overallProgress: number;
  activeCount: number;
  achievedCount: number;
  archivedCount: number;
  storageAllocation: Record<string, StorageAccountAllocation>;
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
    effectiveRate,
    monthsToGoal,
    estimatedYearMonth,
  };
}

const GOAL_PRIORITY_RANK: Record<GoalPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function computeGoalsPortfolioSummary(
  goals: Goal[],
  accounts: Account[],
  savingsRules: SavingsRule[],
  balances: Record<string, number>,
  transactions: Transaction[],
  goalTransfers: GoalTransfer[],
  asOfDate: string,
): GoalsPortfolioSummary {
  const accountMap = new Map(accounts.filter((a) => !a.deletedAt).map((a) => [a.id, a]));
  const activeItems: GoalPortfolioItem[] = [];
  const archivedItems: GoalPortfolioItem[] = [];

  for (const goal of goals) {
    if (goal.deletedAt) continue;
    const envelope = computeGoalEnvelope(
      goal,
      accounts,
      savingsRules,
      transactions,
      goalTransfers,
      asOfDate,
    );
    const storageAccount = goal.storageAccountId
      ? (accountMap.get(goal.storageAccountId) ?? null)
      : null;

    if (goal.isArchived) {
      archivedItems.push({ goal, envelope, storageAccount });
    } else {
      activeItems.push({ goal, envelope, storageAccount });
    }
  }

  activeItems.sort((a, b) => {
    const prioDiff = GOAL_PRIORITY_RANK[a.goal.priority] - GOAL_PRIORITY_RANK[b.goal.priority];
    if (prioDiff !== 0) return prioDiff;

    const orderDiff = (a.goal.sortOrder ?? 0) - (b.goal.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;

    return a.goal.name.localeCompare(b.goal.name);
  });

  let totalSavedMinor = 0;
  let totalTargetMinor = 0;
  let totalRemainingMinor = 0;
  let totalMonthlyPlanMinor = 0;
  let achievedCount = 0;

  const storageAllocation: Record<string, StorageAccountAllocation> = {};

  for (const item of activeItems) {
    const { goal, envelope, storageAccount } = item;
    totalSavedMinor += envelope.currentMinor;
    totalTargetMinor += goal.targetAmountMinor;
    totalRemainingMinor += envelope.remainingMinor;
    if (envelope.isAchieved) {
      achievedCount += 1;
    } else {
      totalMonthlyPlanMinor += goal.monthlyPlanMinor;
    }

    if (storageAccount) {
      const existing = storageAllocation[storageAccount.id];
      const accountBalanceMinor =
        balances[storageAccount.id] ?? storageAccount.initialBalanceMinor;
      if (existing) {
        existing.allocatedMinor += envelope.currentMinor;
        existing.freeMinor = existing.accountBalanceMinor - existing.allocatedMinor;
      } else {
        storageAllocation[storageAccount.id] = {
          accountId: storageAccount.id,
          accountName: storageAccount.name,
          accountBalanceMinor,
          allocatedMinor: envelope.currentMinor,
          freeMinor: accountBalanceMinor - envelope.currentMinor,
        };
      }
    }
  }

  const overallProgress =
    totalTargetMinor <= 0 ? 0 : Math.min(1, totalSavedMinor / totalTargetMinor);

  return {
    activeItems,
    archivedItems,
    totalSavedMinor,
    totalTargetMinor,
    totalRemainingMinor,
    totalMonthlyPlanMinor,
    overallProgress,
    activeCount: activeItems.length,
    achievedCount,
    archivedCount: archivedItems.length,
    storageAllocation,
  };
}
