import { isConfirmedActiveTx } from "./balances";
import type { Debt, Transaction } from "./types";

export interface DebtLedgerRow {
  debtId: string;
  direction: Debt["direction"];
  counterparty: string;
  amountMinor: number;
  manualRepaidMinor: number;
  repaidFromTransactionsMinor: number;
  remainingMinor: number;
  status: "open" | "closed";
  openedAt: string;
}

export interface DebtsLedgerSummary {
  rows: DebtLedgerRow[];
  totalLentRemainingMinor: number;
  totalBorrowedRemainingMinor: number;
  netDebtBalanceMinor: number;
  openCount: number;
  closedCount: number;
}

export function computeDebtsLedger(
  debts: Debt[],
  transactions: Transaction[],
): DebtsLedgerSummary {
  const activeDebts = debts
    .filter((d) => !d.deletedAt)
    .map((d, idx) => ({ debt: d, idx }))
    .sort((a, b) => {
      const dateCmp = a.debt.openedAt.localeCompare(b.debt.openedAt);
      return dateCmp !== 0 ? dateCmp : a.idx - b.idx;
    });

  const repaidMap = new Map<string, number>();
  for (const item of activeDebts) {
    repaidMap.set(item.debt.id, 0);
  }

  const activeTxs = transactions.filter(isConfirmedActiveTx);

  // Pass 1: exact debtId links
  for (const tx of activeTxs) {
    if (!tx.debtId) continue;
    const target = activeDebts.find((item) => item.debt.id === tx.debtId)?.debt;
    if (!target) continue;

    const expectedType =
      target.direction === "lent" ? "debt_received_back" : "debt_paid_back";
    if (tx.type !== expectedType) continue;

    repaidMap.set(target.id, (repaidMap.get(target.id) ?? 0) + tx.amountMinor);
  }

  // Pass 2: FIFO keyword fallback for Android push / manual transactions without debtId
  const unlinkedPools: Record<"lent" | "borrowed", number> = { lent: 0, borrowed: 0 };
  const unlinkedByDirection: { lent: Transaction[]; borrowed: Transaction[] } = {
    lent: [],
    borrowed: [],
  };

  for (const tx of activeTxs) {
    if (tx.debtId) continue;
    if (tx.type === "debt_received_back") unlinkedByDirection.lent.push(tx);
    if (tx.type === "debt_paid_back") unlinkedByDirection.borrowed.push(tx);
  }

  for (const direction of ["lent", "borrowed"] as const) {
    const poolTxs = unlinkedByDirection[direction];
    for (const tx of poolTxs) {
      let remainingTxAmount = tx.amountMinor;
      const commentLower = tx.comment.toLowerCase();

      for (const { debt } of activeDebts) {
        if (remainingTxAmount <= 0) break;
        if (debt.direction !== direction) continue;

        const needle = debt.counterparty.trim().toLowerCase();
        if (!needle || !commentLower.includes(needle)) continue;

        const alreadyRepaid = (repaidMap.get(debt.id) ?? 0) + debt.manualRepaidMinor;
        const capacity = Math.max(0, debt.amountMinor - alreadyRepaid);
        if (capacity <= 0) continue;

        const applied = Math.min(capacity, remainingTxAmount);
        repaidMap.set(debt.id, (repaidMap.get(debt.id) ?? 0) + applied);
        remainingTxAmount -= applied;
      }

      unlinkedPools[direction] += remainingTxAmount;
    }
  }

  let totalLentRemainingMinor = 0;
  let totalBorrowedRemainingMinor = 0;
  let openCount = 0;
  let closedCount = 0;

  const rows: DebtLedgerRow[] = activeDebts.map(({ debt }) => {
    const repaidFromTransactionsMinor = Math.min(
      Math.max(0, debt.amountMinor - debt.manualRepaidMinor),
      repaidMap.get(debt.id) ?? 0,
    );
    const remainingMinor = Math.max(
      0,
      debt.amountMinor - debt.manualRepaidMinor - repaidFromTransactionsMinor,
    );
    const status: "open" | "closed" = remainingMinor <= 0 ? "closed" : "open";

    if (status === "closed") closedCount += 1;
    else openCount += 1;

    if (debt.direction === "lent") totalLentRemainingMinor += remainingMinor;
    else totalBorrowedRemainingMinor += remainingMinor;

    return {
      debtId: debt.id,
      direction: debt.direction,
      counterparty: debt.counterparty,
      amountMinor: debt.amountMinor,
      manualRepaidMinor: debt.manualRepaidMinor,
      repaidFromTransactionsMinor,
      remainingMinor,
      status,
      openedAt: debt.openedAt,
    };
  });

  return {
    rows,
    totalLentRemainingMinor,
    totalBorrowedRemainingMinor,
    netDebtBalanceMinor: totalLentRemainingMinor - totalBorrowedRemainingMinor,
    openCount,
    closedCount,
  };
}
