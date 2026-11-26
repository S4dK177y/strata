import type { Account, Category, Debt, Transaction } from "./types";

export function isConfirmedActiveTx(tx: Transaction): boolean {
  return !tx.deletedAt && tx.status === "confirmed";
}

export function extractYearMonth(occurredAt: string): { year: number; month: number; dateStr: string } {
  const dateStr = occurredAt.slice(0, 10);
  const parts = dateStr.split("-");
  const year = Number(parts[0] ?? 0);
  const month = Number(parts[1] ?? 0);
  return { year, month, dateStr };
}

export function computeAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.initialBalanceMinor;

  for (const tx of transactions) {
    if (!isConfirmedActiveTx(tx)) continue;

    if (tx.accountFromId === account.id) {
      switch (tx.type) {
        case "income":
        case "passive_income":
        case "compensation":
        case "transit_in":
        case "debt_received_back":
        case "debt_borrowed":
          balance += tx.amountMinor;
          break;
        case "expense":
        case "transfer":
        case "transit_out":
        case "debt_given":
        case "debt_paid_back":
          balance -= tx.amountMinor;
          break;
      }
    }

    if (tx.type === "transfer" && tx.accountToId === account.id) {
      balance += tx.amountMinor;
    }
  }

  return balance;
}

export function computeAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const acc of accounts) {
    if (acc.deletedAt) continue;
    result[acc.id] = computeAccountBalance(acc, transactions);
  }
  return result;
}

export function computeCreditCardDebt(
  accounts: Account[],
  balances: Record<string, number>,
): number {
  let creditSum = 0;
  for (const acc of accounts) {
    if (acc.deletedAt || acc.type !== "credit") continue;
    creditSum += balances[acc.id] ?? 0;
  }
  return Math.max(0, -creditSum);
}

export function computeCreditCardAvailable(account: Account, currentBalanceMinor: number): number {
  return Math.max(0, account.creditLimitMinor + currentBalanceMinor);
}

export function computeNetWorth(
  accounts: Account[],
  balances: Record<string, number>,
  totalBorrowedRemainingMinor: number,
): number {
  let sumAccounts = 0;
  for (const acc of accounts) {
    if (acc.deletedAt) continue;
    sumAccounts += balances[acc.id] ?? 0;
  }
  return sumAccounts - totalBorrowedRemainingMinor;
}

export function computeSafeToSpend(
  accounts: Account[],
  balances: Record<string, number>,
  unpaidActiveRecurringMinor: number,
): number {
  let liquidSum = 0;
  for (const acc of accounts) {
    if (acc.deletedAt) continue;
    if (acc.type === "debit" || acc.type === "cash") {
      liquidSum += balances[acc.id] ?? 0;
    }
  }
  const creditDebt = computeCreditCardDebt(accounts, balances);
  return liquidSum - unpaidActiveRecurringMinor - creditDebt;
}

export interface PeriodSummary {
  activeIncomeMinor: number;
  passiveIncomeMinor: number;
  totalIncomeMinor: number;
  grossExpenseMinor: number;
  compensationMinor: number;
  netExpenseMinor: number;
  netBalanceMinor: number;
  savingsRate: number;
  transactionCount: number;
}

export function computePeriodSummary(
  transactions: Transaction[],
  year: number,
  month: number | null = null,
): PeriodSummary {
  let activeIncomeMinor = 0;
  let passiveIncomeMinor = 0;
  let grossExpenseMinor = 0;
  let compensationMinor = 0;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (!isConfirmedActiveTx(tx)) continue;
    const ym = extractYearMonth(tx.occurredAt);
    if (ym.year !== year) continue;
    if (month !== null && month !== 0 && ym.month !== month) continue;

    transactionCount += 1;
    if (tx.type === "income") activeIncomeMinor += tx.amountMinor;
    else if (tx.type === "passive_income") passiveIncomeMinor += tx.amountMinor;
    else if (tx.type === "expense") grossExpenseMinor += tx.amountMinor;
    else if (tx.type === "compensation") compensationMinor += tx.amountMinor;
  }

  const totalIncomeMinor = activeIncomeMinor + passiveIncomeMinor;
  const netExpenseMinor = Math.max(0, grossExpenseMinor - compensationMinor);
  const netBalanceMinor = totalIncomeMinor - netExpenseMinor;
  const savingsRate = totalIncomeMinor <= 0 ? 0 : netBalanceMinor / totalIncomeMinor;

  return {
    activeIncomeMinor,
    passiveIncomeMinor,
    totalIncomeMinor,
    grossExpenseMinor,
    compensationMinor,
    netExpenseMinor,
    netBalanceMinor,
    savingsRate,
    transactionCount,
  };
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  netSpentMinor: number;
  monthlyLimitMinor: number | null;
  periodLimitMinor: number | null;
  share: number;
  isOverLimit: boolean;
}

export function computeCategoryBreakdown(
  categories: Category[],
  transactions: Transaction[],
  year: number,
  month: number | null = null,
): CategoryBreakdownItem[] {
  const expenseCats = categories.filter((c) => !c.deletedAt && c.kind === "expense");
  const grossByCat = new Map<string, number>();
  const compByCat = new Map<string, number>();

  for (const tx of transactions) {
    if (!isConfirmedActiveTx(tx) || !tx.categoryId) continue;
    const ym = extractYearMonth(tx.occurredAt);
    if (ym.year !== year) continue;
    if (month !== null && month !== 0 && ym.month !== month) continue;

    if (tx.type === "expense") {
      grossByCat.set(tx.categoryId, (grossByCat.get(tx.categoryId) ?? 0) + tx.amountMinor);
    } else if (tx.type === "compensation") {
      compByCat.set(tx.categoryId, (compByCat.get(tx.categoryId) ?? 0) + tx.amountMinor);
    }
  }

  const raw = expenseCats.map((cat) => {
    const netSpentMinor = Math.max(0, (grossByCat.get(cat.id) ?? 0) - (compByCat.get(cat.id) ?? 0));
    const isWholeYear = month === null || month === 0;
    const periodLimitMinor =
      cat.monthlyLimitMinor === null
        ? null
        : isWholeYear
          ? cat.monthlyLimitMinor * 12
          : cat.monthlyLimitMinor;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      netSpentMinor,
      monthlyLimitMinor: cat.monthlyLimitMinor,
      periodLimitMinor,
      isOverLimit: periodLimitMinor !== null && netSpentMinor > periodLimitMinor,
    };
  });

  const totalNet = raw.reduce((acc, item) => acc + item.netSpentMinor, 0);

  return raw.map((item) => ({
    ...item,
    share: totalNet <= 0 ? 0 : item.netSpentMinor / totalNet,
  }));
}

export interface MonthlySeriesPoint {
  month: number; // 1..12
  incomeMinor: number;
  passiveIncomeMinor: number;
  netExpenseMinor: number;
  netBalanceMinor: number;
  savingsRate: number;
  netWorthMinor: number | null;
}

export function computeMonthlySeries(
  accounts: Account[],
  transactions: Transaction[],
  debts: Debt[],
  year: number,
): MonthlySeriesPoint[] {
  const points: MonthlySeriesPoint[] = [];

  for (let m = 1; m <= 12; m += 1) {
    const summary = computePeriodSummary(transactions, year, m);
    const eomKey = `${year}-${String(m).padStart(2, "0")}-31`;

    let hasAnyTxInMonth = false;
    for (const tx of transactions) {
      if (!isConfirmedActiveTx(tx)) continue;
      const ym = extractYearMonth(tx.occurredAt);
      if (ym.year === year && ym.month === m) {
        hasAnyTxInMonth = true;
        break;
      }
    }

    let netWorthMinor: number | null = null;
    if (hasAnyTxInMonth) {
      const txUpToEom = transactions.filter(
        (tx) => isConfirmedActiveTx(tx) && extractYearMonth(tx.occurredAt).dateStr <= eomKey,
      );
      const balancesEom = computeAllAccountBalances(accounts, txUpToEom);

      const borrowedDebtsUpToEom = debts.filter(
        (d) => !d.deletedAt && d.direction === "borrowed" && d.openedAt.slice(0, 10) <= eomKey,
      );
      let borrowedInitial = 0;
      for (const d of borrowedDebtsUpToEom) {
        borrowedInitial += Math.max(0, d.amountMinor - d.manualRepaidMinor);
      }
      let borrowedRepaidUpToEom = 0;
      for (const tx of txUpToEom) {
        if (tx.type === "debt_paid_back") {
          borrowedRepaidUpToEom += tx.amountMinor;
        }
      }
      const borrowedRemainingEom = Math.max(0, borrowedInitial - borrowedRepaidUpToEom);
      netWorthMinor = computeNetWorth(accounts, balancesEom, borrowedRemainingEom);
    }

    points.push({
      month: m,
      incomeMinor: summary.totalIncomeMinor,
      passiveIncomeMinor: summary.passiveIncomeMinor,
      netExpenseMinor: summary.netExpenseMinor,
      netBalanceMinor: summary.netBalanceMinor,
      savingsRate: summary.savingsRate,
      netWorthMinor,
    });
  }

  return points;
}
