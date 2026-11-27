"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  evaluateRecurringPayments,
  type RecurringItemStatus,
} from "@strata/finance-core";
import type {
  Account,
  Category,
  RecurringPayment,
  RecurringPaymentMark,
  Transaction,
} from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCategoryIcon } from "@/lib/category-icons";
import {
  toCoreRecurringPayment,
  toCoreRecurringPaymentMark,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface RecurringPaymentsSectionProps {
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  recurringPayments: RecurringPayment[];
  marks: RecurringPaymentMark[];
  transactions: Transaction[];
  currentYear: number;
  currentMonth: number;
  asOfDate: string;
  onOpenPaymentForm: (payment: RecurringPayment | null) => void;
  onRefresh: () => Promise<void>;
}

function getStatusBadgeTone(
  status: RecurringItemStatus
): "default" | "ok" | "warn" | "danger" {
  switch (status) {
    case "paid":
      return "ok";
    case "due_soon":
      return "warn";
    case "overdue":
      return "danger";
    default:
      return "default";
  }
}

export function RecurringPaymentsSection({
  baseCurrency,
  accounts,
  categories,
  recurringPayments,
  marks,
  transactions,
  currentYear,
  currentMonth,
  asOfDate,
  onOpenPaymentForm,
  onRefresh,
}: RecurringPaymentsSectionProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd } = useQuickAdd();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [busyMarkId, setBusyMarkId] = useState<string | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<RecurringPayment | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const apiPaymentMap = useMemo(
    () => new Map(recurringPayments.map((p) => [p.id, p])),
    [recurringPayments]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const txMap = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, tx])),
    [transactions]
  );

  const summary = useMemo(
    () =>
      evaluateRecurringPayments({
        payments: recurringPayments.map(toCoreRecurringPayment),
        marks: marks.map(toCoreRecurringPaymentMark),
        transactions: transactions.map(toCoreTransaction),
        year: selectedYear,
        month: selectedMonth,
        asOfDate,
      }),
    [recurringPayments, marks, transactions, selectedYear, selectedMonth, asOfDate]
  );

  const periodLabel = useMemo(() => {
    const formatted = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(selectedYear, selectedMonth - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [selectedYear, selectedMonth, locale]);

  const isCurrentPeriod =
    selectedYear === currentYear && selectedMonth === currentMonth;

  const progressPct =
    summary.activeCount > 0
      ? Math.round((summary.paidCount / summary.activeCount) * 100)
      : 0;

  function shiftMonth(delta: number) {
    const next = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth() + 1);
  }

  async function handleMarkPaid(paymentId: string) {
    setBusyMarkId(paymentId);
    try {
      const res = await fetch(`/api/v1/recurring-payments/${paymentId}/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_key: summary.periodKey }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.recurring.markedToast);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyMarkId(null);
    }
  }

  async function handleUnmarkPaid(paymentId: string) {
    setBusyMarkId(paymentId);
    try {
      const res = await fetch(
        `/api/v1/recurring-payments/${paymentId}/marks/${summary.periodKey}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.recurring.unmarkedToast);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyMarkId(null);
    }
  }

  async function handleToggleActive(payment: RecurringPayment) {
    try {
      const res = await fetch(`/api/v1/recurring-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !payment.is_active }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(
        payment.is_active
          ? t.plans.recurring.pausedToast
          : t.plans.recurring.resumedToast
      );
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    }
  }

  async function handleDeletePayment() {
    if (!deletingPayment) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/v1/recurring-payments/${deletingPayment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.recurring.deletedToast);
      setDeletingPayment(null);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Month Selector & Recurring Summary Card */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.plans.recurring.prevMonth}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-initial">
              <span className="min-w-28 truncate px-1 text-center text-sm font-bold text-[var(--strata-text-primary)] sm:min-w-36">
                {periodLabel}
              </span>
              {!isCurrentPeriod ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear(currentYear);
                    setSelectedMonth(currentMonth);
                  }}
                  className="min-h-8 shrink-0 cursor-pointer rounded-full border border-[var(--strata-border-subtle)] px-2.5 text-xs font-semibold text-[var(--strata-accent-brand)] transition hover:border-[var(--strata-border-strong)]"
                >
                  {t.plans.recurring.currentMonth}
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.plans.recurring.nextMonth}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>

          {isCurrentPeriod && summary.unpaidActiveRecurringMinor > 0 ? (
            <span className="text-xs text-[var(--strata-text-muted)]">
              {t.plans.recurring.safeToSpendNote}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--strata-border-subtle)] pt-3.5 sm:gap-4">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.recurring.unpaidLabel}
            </div>
            <div
              className={cn(
                "mt-0.5 truncate text-sm font-extrabold sm:text-base",
                summary.unpaidActiveRecurringMinor > 0
                  ? "text-[var(--strata-text-primary)]"
                  : "text-[var(--strata-money-income)]"
              )}
            >
              <AmountText
                minor={summary.unpaidActiveRecurringMinor}
                currency={baseCurrency}
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.recurring.paidLabel}
            </div>
            <div className="strata-money mt-0.5 truncate text-sm font-bold text-[var(--strata-money-income)] sm:text-base">
              {t.plans.recurring.paidProgressLabel
                .replace("{paid}", String(summary.paidCount))
                .replace("{total}", String(summary.activeCount))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.recurring.monthlyLoadLabel}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-[var(--strata-text-primary)] sm:text-base">
              <AmountText
                minor={summary.totalMonthlyEquivalentMinor}
                currency={baseCurrency}
              />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              backgroundColor: "var(--strata-money-income)",
            }}
          />
        </div>
      </Card>

      {/* Recurring Payment List */}
      {summary.items.length === 0 ? (
        <Card className="space-y-3 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--strata-bg-elevated)] text-[var(--strata-text-muted)]">
            <Repeat className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--strata-text-primary)]">
              {t.plans.recurring.emptyTitle}
            </h2>
            <p className="mx-auto max-w-md text-xs text-[var(--strata-text-muted)] sm:text-sm">
              {t.plans.recurring.emptyBody}
            </p>
          </div>
          <div className="pt-1">
            <Button type="button" onClick={() => onOpenPaymentForm(null)}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t.plans.actions.addPayment}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {summary.items.map((item) => {
            const { payment } = item;
            const apiPayment = apiPaymentMap.get(payment.id);
            const category = payment.categoryId
              ? categoryMap.get(payment.categoryId)
              : null;
            const account = payment.accountId ? accountMap.get(payment.accountId) : null;
            const matchedTx = item.matchedTransactionId
              ? txMap.get(item.matchedTransactionId)
              : null;
            const Icon = category ? getCategoryIcon(category.icon) : Repeat;
            const tone = getStatusBadgeTone(item.status);
            const displayCurrency = account?.currency ?? baseCurrency;

            let badgeLabel = t.plans.recurring.status[item.status];
            if (item.status === "paid" && item.paidVia) {
              badgeLabel = `${t.plans.recurring.status.paid} · ${t.plans.recurring.paidVia[item.paidVia]}`;
            } else if (item.status === "overdue") {
              badgeLabel = t.plans.recurring.overdueDays.replace(
                "{days}",
                String(Math.abs(item.daysUntilDue))
              );
            } else if (item.status === "due_soon") {
              badgeLabel =
                item.daysUntilDue === 0
                  ? t.plans.recurring.dueToday
                  : t.plans.recurring.dueInDays.replace(
                      "{days}",
                      String(item.daysUntilDue)
                    );
            }

            return (
              <Card
                key={payment.id}
                className={cn(
                  "space-y-3 p-4",
                  !payment.isActive && "opacity-65"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[var(--strata-text-primary)] sm:text-[15px]">
                          {payment.name}
                        </span>
                        <Badge tone={tone}>{badgeLabel}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--strata-text-muted)]">
                        <span>{t.plans.recurring.cadence[payment.cadence]}</span>
                        <span>
                          ·{" "}
                          {t.plans.recurring.dayOfMonth.replace(
                            "{day}",
                            String(payment.dayOfMonth)
                          )}
                        </span>
                        {account ? <span className="truncate">· {account.name}</span> : null}
                        {payment.matchKeyword ? (
                          <span className="truncate">
                            ·{" "}
                            {t.plans.recurring.keywordTag.replace(
                              "{kw}",
                              payment.matchKeyword
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="whitespace-nowrap text-right text-sm font-extrabold text-[var(--strata-text-primary)] sm:text-base">
                      <AmountText
                        minor={payment.amountMinor}
                        currency={displayCurrency}
                      />
                    </div>

                    {apiPayment ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t.capital.actionsLabel}
                            className="h-8 w-8 rounded-xl"
                          >
                            <MoreHorizontal
                              className="h-4 w-4"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onOpenPaymentForm(apiPayment)}>
                            <Pencil
                              className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span>{t.plans.recurring.editPayment}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleToggleActive(apiPayment)}
                          >
                            {apiPayment.is_active ? (
                              <Pause
                                className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            ) : (
                              <Play
                                className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {apiPayment.is_active
                                ? t.plans.recurring.pause
                                : t.plans.recurring.resume}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setDeletingPayment(apiPayment)}
                            className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t.plans.recurring.deletePayment}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>

                {/* Action Row */}
                {payment.isActive ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--strata-border-subtle)] pt-2.5">
                    {!item.isPaid ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busyMarkId === payment.id}
                          onClick={() => void handleMarkPaid(payment.id)}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          <span>{t.plans.recurring.markPaid}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            openQuickAdd({
                              type: "expense",
                              amountMinor: payment.amountMinor,
                              accountFromId: payment.accountId ?? undefined,
                              categoryId: payment.categoryId ?? undefined,
                              comment: payment.name,
                              recurringPaymentId: payment.id,
                              recurringPaymentName: payment.name,
                            })
                          }
                        >
                          <CreditCard
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{t.plans.recurring.payButton}</span>
                        </Button>
                      </>
                    ) : item.paidVia === "mark" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyMarkId === payment.id}
                        onClick={() => void handleUnmarkPaid(payment.id)}
                      >
                        <RotateCcw
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>{t.plans.recurring.unmarkPaid}</span>
                      </Button>
                    ) : matchedTx ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openQuickAdd({ transaction: matchedTx })}
                      >
                        <span>{t.plans.recurring.viewTx}</span>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onOpenChange={(next) => {
          if (!next) setDeletingPayment(null);
        }}
        title={t.plans.recurring.deletePaymentTitle}
        description={t.plans.recurring.deletePaymentBody}
        confirmLabel={t.common.delete}
        busy={deletingBusy}
        onConfirm={() => void handleDeletePayment()}
      />
    </div>
  );
}
