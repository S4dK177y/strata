import {
  computeCategoryBreakdown,
  computeMonthlySeries,
  computePeriodSummary,
  extractYearMonth,
  isConfirmedActiveTx,
} from "./balances";
import { computeDebtsLedger } from "./debts";
import type { Account, Category, Debt, Transaction, WrappedSettings } from "./types";

export type FinancialTitleKey =
  | "starter"
  | "live_once"
  | "on_the_edge"
  | "builder"
  | "money_master"
  | "financial_ninja";

export type DisciplineRankKey = "observer" | "apprentice" | "tracker" | "legend";

export interface CounterpartyStats {
  counterparty: string;
  count: number;
  totalAmountMinor: number;
  remainingMinor: number;
}

export interface YearlyWrappedReport {
  year: number;
  titleKey: FinancialTitleKey;
  totalIncomeMinor: number;
  avgMonthlyIncomeMinor: number;
  netExpenseMinor: number;
  avgMonthlyExpenseMinor: number;
  netBalanceMinor: number;
  positiveMonthsCount: number;
  savingsRate: number;
  transactionCount: number;
  disciplineRankKey: DisciplineRankKey;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    netSpentMinor: number;
    shareOfTotalExpense: number;
  }>;
  mostProfitableMonth: { month: number; incomeMinor: number } | null;
  highestSpendMonth: { month: number; netExpenseMinor: number } | null;
  mostFrugalMonth: { month: number; netExpenseMinor: number } | null;
  bestBalanceMonth: { month: number; netBalanceMinor: number } | null;
  topPurchase: {
    amountMinor: number;
    categoryName: string;
    accountName: string;
    comment: string;
    dateStr: string;
    workHoursCost: number | null;
  } | null;
  passiveIncomeMinor: number;
  freeCoffeesCount: number;
  freeShawarmasCount: number;
  freeSubscriptionMonths: number;
  favoriteCard: { accountId: string; accountName: string; expenseCount: number } | null;
  avgExpenseCheckMinor: number;
  costPerDayMinor: number;
  antiFakeFilteredMinor: number;
  autonomyMonths: number | null;
  lentHallOfFame: {
    totalLentMinor: number;
    totalReturnedMinor: number;
    returnRate: number;
    totalRemainingMinor: number;
    mostFrequentBorrower: CounterpartyStats | null;
    biggestBorrower: CounterpartyStats | null;
    biggestPendingDebtor: CounterpartyStats | null;
  };
  borrowedHallOfFame: {
    totalBorrowedMinor: number;
    totalRepaidMinor: number;
    repayRate: number;
    totalRemainingMinor: number;
    mainSavior: CounterpartyStats | null;
    biggestCreditor: CounterpartyStats | null;
    biggestPendingCreditor: CounterpartyStats | null;
  };
}

export const DEFAULT_WRAPPED_SETTINGS: WrappedSettings = {
  coffeePriceMinor: 30000,
  shawarmaPriceMinor: 35000,
  subscriptionAvgMinor: 39900,
  workHoursPerMonth: 168,
  promoWarningDays: 14,
};

export function resolveFinancialTitle(totalIncomeMinor: number, savingsRate: number): FinancialTitleKey {
  if (totalIncomeMinor <= 0) return "starter";
  if (savingsRate < 0) return "live_once";
  if (savingsRate < 0.1) return "on_the_edge";
  if (savingsRate < 0.2) return "builder";
  if (savingsRate < 0.35) return "money_master";
  return "financial_ninja";
}

export function resolveDisciplineRank(transactionCount: number): DisciplineRankKey {
  if (transactionCount === 0) return "observer";
  if (transactionCount < 30) return "apprentice";
  if (transactionCount < 100) return "tracker";
  return "legend";
}

export function computeYearlyWrapped(params: {
  year: number;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  currentNetWorthMinor: number;
  settings?: Partial<WrappedSettings>;
}): YearlyWrappedReport {
  const settings: WrappedSettings = { ...DEFAULT_WRAPPED_SETTINGS, ...params.settings };
  const yearSummary = computePeriodSummary(params.transactions, params.year, null);
  const monthly = computeMonthlySeries(params.accounts, params.transactions, params.debts, params.year);
  const categoryBreakdown = computeCategoryBreakdown(
    params.categories,
    params.transactions,
    params.year,
    null,
  );

  const activeIncomeMonths = monthly.filter((m) => m.incomeMinor > 0).length;
  const activeExpenseMonths = monthly.filter((m) => m.netExpenseMinor > 0).length;
  const positiveMonthsCount = monthly.filter((m) => m.netBalanceMinor > 0).length;

  const avgMonthlyIncomeMinor = Math.round(
    yearSummary.totalIncomeMinor / Math.max(1, activeIncomeMonths),
  );
  const avgMonthlyExpenseMinor = Math.round(
    yearSummary.netExpenseMinor / Math.max(1, activeExpenseMonths),
  );

  const topCategories = categoryBreakdown
    .filter((c) => c.netSpentMinor > 0)
    .sort((a, b) => b.netSpentMinor - a.netSpentMinor)
    .slice(0, 5)
    .map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      netSpentMinor: c.netSpentMinor,
      shareOfTotalExpense:
        yearSummary.netExpenseMinor <= 0 ? 0 : c.netSpentMinor / yearSummary.netExpenseMinor,
    }));

  const maxIncomeMonth = monthly.reduce<(typeof monthly)[number] | null>(
    (best, cur) => (cur.incomeMinor > (best?.incomeMinor ?? 0) ? cur : best),
    null,
  );
  const maxSpendMonth = monthly.reduce<(typeof monthly)[number] | null>(
    (best, cur) => (cur.netExpenseMinor > (best?.netExpenseMinor ?? 0) ? cur : best),
    null,
  );
  const minSpendMonth = monthly
    .filter((m) => m.netExpenseMinor > 0)
    .reduce<(typeof monthly)[number] | null>(
      (best, cur) => (best === null || cur.netExpenseMinor < best.netExpenseMinor ? cur : best),
      null,
    );
  const maxBalanceMonth = monthly.reduce<(typeof monthly)[number] | null>(
    (best, cur) => (cur.netBalanceMinor > (best?.netBalanceMinor ?? 0) ? cur : best),
    null,
  );

  const accountMap = new Map(params.accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(params.categories.map((c) => [c.id, c]));

  const yearTxs = params.transactions.filter(
    (tx) => isConfirmedActiveTx(tx) && extractYearMonth(tx.occurredAt).year === params.year,
  );

  const expenseTxs = yearTxs.filter((tx) => tx.type === "expense");
  const topExpenseTx = expenseTxs.reduce<Transaction | null>(
    (best, cur) => (best === null || cur.amountMinor > best.amountMinor ? cur : best),
    null,
  );

  const hourlyRateMinor =
    avgMonthlyIncomeMinor > 0 && settings.workHoursPerMonth > 0
      ? avgMonthlyIncomeMinor / settings.workHoursPerMonth
      : 0;

  const topPurchase = topExpenseTx
    ? {
        amountMinor: topExpenseTx.amountMinor,
        categoryName: topExpenseTx.categoryId
          ? (categoryMap.get(topExpenseTx.categoryId)?.name ?? "—")
          : "—",
        accountName: topExpenseTx.accountFromId
          ? (accountMap.get(topExpenseTx.accountFromId)?.name ?? "—")
          : "—",
        comment: topExpenseTx.comment,
        dateStr: topExpenseTx.occurredAt.slice(0, 10),
        workHoursCost:
          hourlyRateMinor > 0
            ? Number((topExpenseTx.amountMinor / hourlyRateMinor).toFixed(1))
            : null,
      }
    : null;

  const accountExpenseCounts = new Map<string, number>();
  let totalGrossExpense = 0;
  let antiFakeFilteredMinor = 0;

  for (const tx of yearTxs) {
    if (tx.type === "expense") {
      totalGrossExpense += tx.amountMinor;
      if (tx.accountFromId) {
        accountExpenseCounts.set(
          tx.accountFromId,
          (accountExpenseCounts.get(tx.accountFromId) ?? 0) + 1,
        );
      }
    } else if (
      tx.type === "transfer" ||
      tx.type === "transit_in" ||
      tx.type === "transit_out" ||
      tx.type === "debt_given" ||
      tx.type === "debt_received_back" ||
      tx.type === "debt_borrowed" ||
      tx.type === "debt_paid_back"
    ) {
      antiFakeFilteredMinor += tx.amountMinor;
    } else if (tx.type === "compensation") {
      antiFakeFilteredMinor += 2 * tx.amountMinor;
    }
  }

  let favoriteCard: YearlyWrappedReport["favoriteCard"] = null;
  for (const [accountId, count] of accountExpenseCounts.entries()) {
    if (favoriteCard === null || count > favoriteCard.expenseCount) {
      favoriteCard = {
        accountId,
        accountName: accountMap.get(accountId)?.name ?? "—",
        expenseCount: count,
      };
    }
  }

  const avgExpenseCheckMinor =
    expenseTxs.length === 0 ? 0 : Math.round(totalGrossExpense / expenseTxs.length);
  const costPerDayMinor =
    yearSummary.netExpenseMinor <= 0
      ? 0
      : Math.round(yearSummary.netExpenseMinor / (Math.max(1, activeExpenseMonths) * 30.4));

  const autonomyMonths =
    yearSummary.netExpenseMinor > 0
      ? Number(
          (params.currentNetWorthMinor / (yearSummary.netExpenseMinor / Math.max(1, activeExpenseMonths))).toFixed(1),
        )
      : null;

  // Debt Hall of Fame scoped to debts opened in the selected year
  const ledger = computeDebtsLedger(params.debts, params.transactions);
  const yearRows = ledger.rows.filter((r) => Number(r.openedAt.slice(0, 4)) === params.year);

  function buildDirectionHall(direction: "lent" | "borrowed") {
    const map = new Map<string, CounterpartyStats>();
    let totalAmountMinor = 0;
    let totalRemainingMinor = 0;

    for (const row of yearRows) {
      if (row.direction !== direction) continue;
      totalAmountMinor += row.amountMinor;
      totalRemainingMinor += row.remainingMinor;
      const existing = map.get(row.counterparty) ?? {
        counterparty: row.counterparty,
        count: 0,
        totalAmountMinor: 0,
        remainingMinor: 0,
      };
      existing.count += 1;
      existing.totalAmountMinor += row.amountMinor;
      existing.remainingMinor += row.remainingMinor;
      map.set(row.counterparty, existing);
    }

    const list = Array.from(map.values());
    const byFreq = list.reduce<CounterpartyStats | null>(
      (best, c) => (best === null || c.count > best.count ? c : best),
      null,
    );
    const byTotal = list.reduce<CounterpartyStats | null>(
      (best, c) => (best === null || c.totalAmountMinor > best.totalAmountMinor ? c : best),
      null,
    );
    const byPending = list
      .filter((c) => c.remainingMinor > 0)
      .reduce<CounterpartyStats | null>(
        (best, c) => (best === null || c.remainingMinor > best.remainingMinor ? c : best),
        null,
      );

    const settledMinor = Math.max(0, totalAmountMinor - totalRemainingMinor);
    const settleRate = totalAmountMinor <= 0 ? 1 : settledMinor / totalAmountMinor;

    return {
      totalAmountMinor,
      settledMinor,
      settleRate,
      totalRemainingMinor,
      byFreq,
      byTotal,
      byPending,
    };
  }

  const lentHall = buildDirectionHall("lent");
  const borrowedHall = buildDirectionHall("borrowed");

  return {
    year: params.year,
    titleKey: resolveFinancialTitle(yearSummary.totalIncomeMinor, yearSummary.savingsRate),
    totalIncomeMinor: yearSummary.totalIncomeMinor,
    avgMonthlyIncomeMinor,
    netExpenseMinor: yearSummary.netExpenseMinor,
    avgMonthlyExpenseMinor,
    netBalanceMinor: yearSummary.netBalanceMinor,
    positiveMonthsCount,
    savingsRate: yearSummary.savingsRate,
    transactionCount: yearSummary.transactionCount,
    disciplineRankKey: resolveDisciplineRank(yearSummary.transactionCount),
    topCategories,
    mostProfitableMonth: maxIncomeMonth
      ? { month: maxIncomeMonth.month, incomeMinor: maxIncomeMonth.incomeMinor }
      : null,
    highestSpendMonth: maxSpendMonth
      ? { month: maxSpendMonth.month, netExpenseMinor: maxSpendMonth.netExpenseMinor }
      : null,
    mostFrugalMonth: minSpendMonth
      ? { month: minSpendMonth.month, netExpenseMinor: minSpendMonth.netExpenseMinor }
      : null,
    bestBalanceMonth: maxBalanceMonth
      ? { month: maxBalanceMonth.month, netBalanceMinor: maxBalanceMonth.netBalanceMinor }
      : null,
    topPurchase,
    passiveIncomeMinor: yearSummary.passiveIncomeMinor,
    freeCoffeesCount:
      settings.coffeePriceMinor > 0
        ? Math.floor(yearSummary.passiveIncomeMinor / settings.coffeePriceMinor)
        : 0,
    freeShawarmasCount:
      settings.shawarmaPriceMinor > 0
        ? Math.floor(yearSummary.passiveIncomeMinor / settings.shawarmaPriceMinor)
        : 0,
    freeSubscriptionMonths:
      settings.subscriptionAvgMinor > 0
        ? Number((yearSummary.passiveIncomeMinor / settings.subscriptionAvgMinor).toFixed(1))
        : 0,
    favoriteCard,
    avgExpenseCheckMinor,
    costPerDayMinor,
    antiFakeFilteredMinor,
    autonomyMonths,
    lentHallOfFame: {
      totalLentMinor: lentHall.totalAmountMinor,
      totalReturnedMinor: lentHall.settledMinor,
      returnRate: lentHall.settleRate,
      totalRemainingMinor: lentHall.totalRemainingMinor,
      mostFrequentBorrower: lentHall.byFreq,
      biggestBorrower: lentHall.byTotal,
      biggestPendingDebtor: lentHall.byPending,
    },
    borrowedHallOfFame: {
      totalBorrowedMinor: borrowedHall.totalAmountMinor,
      totalRepaidMinor: borrowedHall.settledMinor,
      repayRate: borrowedHall.settleRate,
      totalRemainingMinor: borrowedHall.totalRemainingMinor,
      mainSavior: borrowedHall.byFreq,
      biggestCreditor: borrowedHall.byTotal,
      biggestPendingCreditor: borrowedHall.byPending,
    },
  };
}
