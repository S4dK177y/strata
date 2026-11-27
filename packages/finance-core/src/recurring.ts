import { isConfirmedActiveTx } from "./balances";
import { diffCalendarDays } from "./savings";
import type {
  RecurringCadence,
  RecurringPayment,
  RecurringPaymentMark,
  Transaction,
} from "./types";

export type RecurringPaidVia = "mark" | "transaction" | "keyword" | null;
export type RecurringItemStatus = "overdue" | "due_soon" | "upcoming" | "paid" | "paused";

export interface EvaluatedRecurringPayment {
  payment: RecurringPayment;
  periodKey: string;
  dueDate: string;
  daysUntilDue: number;
  isPaid: boolean;
  paidVia: RecurringPaidVia;
  markId: string | null;
  matchedTransactionId: string | null;
  paidAmountMinor: number | null;
  monthlyEquivalentMinor: number;
  periodReserveMinor: number;
  status: RecurringItemStatus;
}

export interface RecurringMonthSummary {
  periodKey: string;
  items: EvaluatedRecurringPayment[];
  activeCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalMonthlyEquivalentMinor: number;
  paidMonthlyEquivalentMinor: number;
  unpaidActiveRecurringMinor: number;
}

export function getPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMonthlyEquivalentMinor(
  amountMinor: number,
  cadence: RecurringCadence,
): number {
  const safeAmount = Math.max(0, amountMinor);
  switch (cadence) {
    case "weekly":
      return Math.round((safeAmount * 52) / 12);
    case "monthly":
      return safeAmount;
    case "quarterly":
      return Math.round(safeAmount / 3);
    case "yearly":
      return Math.round(safeAmount / 12);
  }
}

const STATUS_PRIORITY: Record<RecurringItemStatus, number> = {
  overdue: 0,
  due_soon: 1,
  upcoming: 2,
  paid: 3,
  paused: 4,
};

export function evaluateRecurringPayments(params: {
  payments: RecurringPayment[];
  marks: RecurringPaymentMark[];
  transactions: Transaction[];
  year: number;
  month: number;
  asOfDate: string;
}): RecurringMonthSummary {
  const { payments, marks, transactions, year, month, asOfDate } = params;
  const periodKey = getPeriodKey(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const activeMarksByPaymentId = new Map<string, RecurringPaymentMark>();
  for (const mark of marks) {
    if (mark.deletedAt || mark.periodKey !== periodKey) continue;
    if (!activeMarksByPaymentId.has(mark.recurringPaymentId)) {
      activeMarksByPaymentId.set(mark.recurringPaymentId, mark);
    }
  }

  const periodConfirmedTxs = transactions.filter(
    (tx) => isConfirmedActiveTx(tx) && tx.occurredAt.slice(0, 7) === periodKey,
  );

  const items: EvaluatedRecurringPayment[] = [];
  let activeCount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let totalMonthlyEquivalentMinor = 0;
  let paidMonthlyEquivalentMinor = 0;
  let unpaidActiveRecurringMinor = 0;

  for (const payment of payments) {
    if (payment.deletedAt) continue;

    const clampedDay = Math.min(Math.max(1, payment.dayOfMonth), daysInMonth);
    const dueDate = `${periodKey}-${String(clampedDay).padStart(2, "0")}`;
    const daysUntilDue = diffCalendarDays(dueDate, asOfDate);
    const monthlyEquivalentMinor = getMonthlyEquivalentMinor(payment.amountMinor, payment.cadence);

    let isPaid = false;
    let paidVia: RecurringPaidVia = null;
    let markId: string | null = null;
    let matchedTransactionId: string | null = null;
    let paidAmountMinor: number | null = null;

    const directMark = activeMarksByPaymentId.get(payment.id);
    if (directMark) {
      isPaid = true;
      paidVia = "mark";
      markId = directMark.id;
    } else {
      const linkedTx = periodConfirmedTxs.find((tx) => tx.recurringPaymentId === payment.id);
      if (linkedTx) {
        isPaid = true;
        paidVia = "transaction";
        matchedTransactionId = linkedTx.id;
        paidAmountMinor = linkedTx.amountMinor;
      } else if (payment.matchKeyword && payment.matchKeyword.trim().length > 0) {
        const needle = payment.matchKeyword.trim().toLowerCase();
        const keywordTx = periodConfirmedTxs.find(
          (tx) => tx.type === "expense" && tx.comment.toLowerCase().includes(needle),
        );
        if (keywordTx) {
          isPaid = true;
          paidVia = "keyword";
          matchedTransactionId = keywordTx.id;
          paidAmountMinor = keywordTx.amountMinor;
        }
      }
    }

    const periodReserveMinor = payment.isActive && !isPaid ? monthlyEquivalentMinor : 0;

    let status: RecurringItemStatus;
    if (!payment.isActive) {
      status = "paused";
    } else if (isPaid) {
      status = "paid";
    } else if (daysUntilDue < 0) {
      status = "overdue";
    } else if (daysUntilDue <= 3) {
      status = "due_soon";
    } else {
      status = "upcoming";
    }

    if (payment.isActive) {
      activeCount += 1;
      totalMonthlyEquivalentMinor += monthlyEquivalentMinor;
      if (isPaid) {
        paidCount += 1;
        paidMonthlyEquivalentMinor += monthlyEquivalentMinor;
      } else {
        unpaidCount += 1;
        unpaidActiveRecurringMinor += periodReserveMinor;
        if (status === "overdue") overdueCount += 1;
        else if (status === "due_soon") dueSoonCount += 1;
      }
    }

    items.push({
      payment,
      periodKey,
      dueDate,
      daysUntilDue,
      isPaid,
      paidVia,
      markId,
      matchedTransactionId,
      paidAmountMinor,
      monthlyEquivalentMinor,
      periodReserveMinor,
      status,
    });
  }

  items.sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (a.payment.dayOfMonth !== b.payment.dayOfMonth) {
      return a.payment.dayOfMonth - b.payment.dayOfMonth;
    }
    return a.payment.name.localeCompare(b.payment.name);
  });

  return {
    periodKey,
    items,
    activeCount,
    paidCount,
    unpaidCount,
    overdueCount,
    dueSoonCount,
    totalMonthlyEquivalentMinor,
    paidMonthlyEquivalentMinor,
    unpaidActiveRecurringMinor,
  };
}
