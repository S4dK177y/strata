import { describe, expect, it } from "vitest";
import golden from "../test-vectors/golden-scenarios.json";
import {
  computeAllAccountBalances,
  computeCategoryBreakdown,
  computeCreditCardAvailable,
  computeCreditCardDebt,
  computeDebtsLedger,
  computeGoalEnvelope,
  computeMonthlySeries,
  computeNetWorth,
  computePeriodSummary,
  computeSafeToSpend,
  computeSavingsForecast,
  computeSavingsPortfolioSummary,
  computeYearlyWrapped,
  evaluateRecurringPayments,
  getDaysInMonth,
  getMonthlyEquivalentMinor,
  type Account,
  type Category,
  type Debt,
  type Goal,
  type RecurringPayment,
  type RecurringPaymentMark,
  type SavingsRule,
  type Transaction,
} from "../src/index";

describe("Strata Golden Test Vectors", () => {
  const accounts = golden.accounts as Account[];
  const categories = golden.categories as Category[];
  const transactions = golden.transactions as Transaction[];
  const savingsRules = golden.savingsRules as SavingsRule[];
  const goals = golden.goals as Goal[];
  const debts = golden.debts as Debt[];
  const recurringPayments = golden.recurringPayments as RecurringPayment[];
  const recurringMarks = golden.recurringPaymentMarks as RecurringPaymentMark[];

  it("computes exact account balances across all 11 tx types and ignores drafts", () => {
    const balances = computeAllAccountBalances(accounts, transactions);
    expect(balances).toEqual(golden.expected.accountBalances);

    const creditAcc = accounts.find((a) => a.id === "acc-alfa-cred")!;
    expect(computeCreditCardDebt(accounts, balances)).toBe(golden.expected.creditCardDebtMinor);
    expect(computeCreditCardAvailable(creditAcc, balances["acc-alfa-cred"] ?? 0)).toBe(
      golden.expected.creditCardAvailableMinor,
    );
  });

  it("computes Net Worth vs Safe-to-Spend and 2-way FIFO debt ledger", () => {
    const balances = computeAllAccountBalances(accounts, transactions);
    const debtsLedger = computeDebtsLedger(debts, transactions);

    expect(debtsLedger.totalLentRemainingMinor).toBe(golden.expected.debts.totalLentRemainingMinor);
    expect(debtsLedger.totalBorrowedRemainingMinor).toBe(
      golden.expected.debts.totalBorrowedRemainingMinor,
    );
    expect(debtsLedger.netDebtBalanceMinor).toBe(golden.expected.debts.netDebtBalanceMinor);
    expect(debtsLedger.openCount).toBe(golden.expected.debts.openCount);
    expect(debtsLedger.closedCount).toBe(golden.expected.debts.closedCount);

    for (const row of debtsLedger.rows) {
      expect(row.remainingMinor).toBe(
        golden.expected.debts.byIdRemaining[row.debtId as keyof typeof golden.expected.debts.byIdRemaining],
      );
    }

    const netWorth = computeNetWorth(accounts, balances, debtsLedger.totalBorrowedRemainingMinor);
    const safeToSpend = computeSafeToSpend(
      accounts,
      balances,
      golden.unpaidActiveRecurringMinor,
    );

    expect(netWorth).toBe(golden.expected.netWorthMinor);
    expect(safeToSpend).toBe(golden.expected.safeToSpendMinor);
  });

  it("computes net period summary with compensation deduplication", () => {
    const summary = computePeriodSummary(transactions, golden.year, golden.month);
    expect(summary.activeIncomeMinor).toBe(golden.expected.period.activeIncomeMinor);
    expect(summary.passiveIncomeMinor).toBe(golden.expected.period.passiveIncomeMinor);
    expect(summary.totalIncomeMinor).toBe(golden.expected.period.totalIncomeMinor);
    expect(summary.grossExpenseMinor).toBe(golden.expected.period.grossExpenseMinor);
    expect(summary.compensationMinor).toBe(golden.expected.period.compensationMinor);
    expect(summary.netExpenseMinor).toBe(golden.expected.period.netExpenseMinor);
    expect(summary.netBalanceMinor).toBe(golden.expected.period.netBalanceMinor);
    expect(summary.transactionCount).toBe(golden.expected.period.transactionCount);

    const catBreakdown = computeCategoryBreakdown(categories, transactions, golden.year, golden.month);
    const cafe = catBreakdown.find((c) => c.categoryId === "cat-cafe")!;
    expect(cafe.netSpentMinor).toBe(120000);
    expect(cafe.isOverLimit).toBe(false);
  });

  it("computes promo radar and savings forecast", () => {
    const balances = computeAllAccountBalances(accounts, transactions);
    const rule = savingsRules[0]!;
    const forecast = computeSavingsForecast(rule, balances[rule.accountId] ?? 0, golden.asOfDate, 14);

    expect(forecast.radar.status).toBe(golden.expected.promoRadar.status);
    expect(forecast.radar.daysLeft).toBe(golden.expected.promoRadar.daysLeft);
    expect(forecast.effectiveRate).toBe(golden.expected.promoRadar.effectiveRate);
    expect(forecast.monthlyInterestMinor).toBeGreaterThan(0);
    expect(forecast.annualInterestMinor).toBeGreaterThan(forecast.monthlyInterestMinor);

    const portfolio = computeSavingsPortfolioSummary(
      accounts,
      savingsRules,
      balances,
      golden.asOfDate,
      14,
    );
    expect(portfolio.items).toHaveLength(1);
    expect(portfolio.totalTrackedBalanceMinor).toBe(balances["acc-sav-1"]);
    expect(portfolio.weightedEffectiveRate).toBe(0.16);
    expect(portfolio.expiringSoonCount).toBe(1);
    expect(portfolio.alertCount).toBe(1);
  });

  it("evaluates recurring payments with manual marks, keyword match, pauses, and Safe-to-Spend reserve", () => {
    const summary = evaluateRecurringPayments({
      payments: recurringPayments,
      marks: recurringMarks,
      transactions,
      year: golden.year,
      month: golden.month,
      asOfDate: golden.asOfDate,
    });

    expect(summary.periodKey).toBe("2026-11");
    expect(summary.activeCount).toBe(3);
    expect(summary.paidCount).toBe(2);
    expect(summary.unpaidCount).toBe(1);
    expect(summary.unpaidActiveRecurringMinor).toBe(golden.unpaidActiveRecurringMinor);

    const byId = new Map(summary.items.map((item) => [item.payment.id, item]));
    expect(byId.get("rec-internet")?.status).toBe("due_soon");
    expect(byId.get("rec-internet")?.paidVia).toBeNull();
    expect(byId.get("rec-dinner-auto")?.status).toBe("paid");
    expect(byId.get("rec-dinner-auto")?.paidVia).toBe("keyword");
    expect(byId.get("rec-dinner-auto")?.matchedTransactionId).toBe("tx-3");
    expect(byId.get("rec-cloud-mark")?.status).toBe("paid");
    expect(byId.get("rec-cloud-mark")?.paidVia).toBe("mark");
    expect(byId.get("rec-paused")?.status).toBe("paused");
    expect(byId.get("rec-paused")?.periodReserveMinor).toBe(0);

    // Day-of-month clamping for February and cadence monthly equivalents
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    const feb = evaluateRecurringPayments({
      payments: [
        {
          id: "rec-feb",
          name: "End of month",
          categoryId: null,
          accountId: null,
          amountMinor: 120000,
          dayOfMonth: 31,
          cadence: "yearly",
          matchKeyword: null,
          isActive: true,
        },
      ],
      marks: [],
      transactions: [],
      year: 2026,
      month: 2,
      asOfDate: "2026-02-27",
    });
    expect(feb.items[0]?.dueDate).toBe("2026-02-28");
    expect(feb.items[0]?.daysUntilDue).toBe(1);
    expect(feb.items[0]?.status).toBe("due_soon");
    expect(getMonthlyEquivalentMinor(120000, "yearly")).toBe(10000);
    expect(getMonthlyEquivalentMinor(300000, "quarterly")).toBe(100000);
    expect(getMonthlyEquivalentMinor(10000, "weekly")).toBe(43333);
  });

  it("computes virtual goal envelopes with NPER and preserves balance on savings-to-savings transfer", () => {
    for (const goal of goals) {
      const env = computeGoalEnvelope(
        goal,
        accounts,
        savingsRules,
        transactions,
        golden.goalTransfers,
        golden.asOfDate,
      );
      const expected =
        golden.expected.goals[goal.id as keyof typeof golden.expected.goals];
      expect(env.currentMinor).toBe(expected.currentMinor);
      expect(env.remainingMinor).toBe(expected.remainingMinor);
      expect(env.monthsToGoal).toBe(expected.monthsToGoal);
    }
  });

  it("computes accurate monthly series Net Worth matching current Net Worth in active month", () => {
    const balances = computeAllAccountBalances(accounts, transactions);
    const debtsLedger = computeDebtsLedger(debts, transactions);
    const currentNetWorth = computeNetWorth(
      accounts,
      balances,
      debtsLedger.totalBorrowedRemainingMinor,
    );
    const series = computeMonthlySeries(accounts, transactions, debts, golden.year);
    const nov = series.find((p) => p.month === 11)!;
    expect(nov.netWorthMinor).toBe(currentNetWorth);
    expect(series.find((p) => p.month === 1)!.netWorthMinor).toBeNull();
  });

  it("computes Yearly Wrapped metrics accurately", () => {
    const balances = computeAllAccountBalances(accounts, transactions);
    const debtsLedger = computeDebtsLedger(debts, transactions);
    const currentNetWorth = computeNetWorth(
      accounts,
      balances,
      debtsLedger.totalBorrowedRemainingMinor,
    );

    const wrapped = computeYearlyWrapped({
      year: golden.year,
      accounts,
      categories,
      transactions,
      debts,
      currentNetWorthMinor: currentNetWorth,
    });

    expect(wrapped.titleKey).toBe(golden.expected.wrapped.titleKey);
    expect(wrapped.disciplineRankKey).toBe(golden.expected.wrapped.disciplineRankKey);
    expect(wrapped.freeCoffeesCount).toBe(golden.expected.wrapped.freeCoffeesCount);
    expect(wrapped.freeShawarmasCount).toBe(golden.expected.wrapped.freeShawarmasCount);
    expect(wrapped.antiFakeFilteredMinor).toBe(golden.expected.wrapped.antiFakeFilteredMinor);
    expect(wrapped.lentHallOfFame.mostFrequentBorrower?.counterparty).toBe(
      golden.expected.wrapped.lentFrequent,
    );
    expect(wrapped.borrowedHallOfFame.mainSavior?.counterparty).toBe(
      golden.expected.wrapped.borrowedMainSavior,
    );
  });
});
