"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Handshake,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { DebtsLedgerSummary } from "@strata/finance-core";
import type { Debt, DebtDirection, Transaction } from "@strata/api-contract";
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
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface DebtsSectionProps {
  baseCurrency: string;
  debts: Debt[];
  transactions: Transaction[];
  summary: DebtsLedgerSummary;
  onOpenDebtForm: (debt: Debt | null) => void;
  onRefresh: () => Promise<void>;
}

type DirectionFilter = "all" | DebtDirection;

export function DebtsSection({
  baseCurrency,
  debts,
  transactions,
  summary,
  onOpenDebtForm,
  onRefresh,
}: DebtsSectionProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd } = useQuickAdd();

  const [filter, setFilter] = useState<DirectionFilter>("all");
  const [showClosed, setShowClosed] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const apiDebtMap = useMemo(() => new Map(debts.map((d) => [d.id, d])), [debts]);
  const txMap = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, tx])),
    [transactions]
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") return summary.rows;
    return summary.rows.filter((r) => r.direction === filter);
  }, [filter, summary.rows]);

  const openRows = useMemo(
    () => filteredRows.filter((r) => r.status === "open"),
    [filteredRows]
  );
  const closedRows = useMemo(
    () => filteredRows.filter((r) => r.status === "closed"),
    [filteredRows]
  );

  function formatShortDate(isoDate: string): string {
    const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  }

  async function handleCloseManually(debt: Debt, repaidFromTransactionsMinor: number) {
    setBusyId(debt.id);
    try {
      const neededManual = Math.max(0, debt.amount_minor - repaidFromTransactionsMinor);
      const res = await fetch(`/api/v1/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_repaid_minor: neededManual }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.debts.closedToast);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopen(debt: Debt) {
    setBusyId(debt.id);
    try {
      const res = await fetch(`/api/v1/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_repaid_minor: 0 }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.debts.reopenedToast);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteDebt() {
    if (!deletingDebt) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/v1/debts/${deletingDebt.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.debts.deletedToast);
      setDeletingDebt(null);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Unified Debts Summary Card */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium text-[var(--strata-text-muted)]">
              {t.plans.debts.netBalanceLabel}
            </div>
            <div
              className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-[28px]"
              style={{
                color:
                  summary.netDebtBalanceMinor > 0
                    ? "var(--strata-debt-lent)"
                    : summary.netDebtBalanceMinor < 0
                      ? "var(--strata-debt-borrowed)"
                      : "var(--strata-text-primary)",
              }}
            >
              <AmountText
                minor={summary.netDebtBalanceMinor}
                currency={baseCurrency}
                showSign
              />
            </div>
            <p className="mt-0.5 text-xs text-[var(--strata-text-muted)]">
              {summary.netDebtBalanceMinor > 0
                ? t.plans.debts.netPositiveHint
                : summary.netDebtBalanceMinor < 0
                  ? t.plans.debts.netNegativeHint
                  : t.plans.debts.netEvenHint}
            </p>
          </div>

          <div
            role="tablist"
            aria-label={t.plans.debts.form.directionLabel}
            className="grid w-full grid-cols-3 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-1 sm:inline-grid sm:w-auto"
          >
            {(["all", "lent", "borrowed"] as const).map((opt) => {
              const active = filter === opt;
              const label =
                opt === "all"
                  ? t.plans.debts.filterAll
                  : opt === "lent"
                    ? t.plans.debts.filterLent
                    : t.plans.debts.filterBorrowed;
              return (
                <button
                  key={opt}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(opt)}
                  className={cn(
                    "min-h-8 cursor-pointer truncate rounded-xl px-2.5 text-xs font-semibold transition",
                    active
                      ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
                      : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[var(--strata-border-subtle)] pt-3.5 sm:grid-cols-3 sm:gap-4">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.debts.lentTotalLabel}
            </div>
            <div
              className="mt-0.5 truncate text-xs font-bold sm:text-sm"
              style={{ color: "var(--strata-debt-lent)" }}
            >
              <AmountText minor={summary.totalLentRemainingMinor} currency={baseCurrency} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.debts.borrowedTotalLabel}
            </div>
            <div
              className="mt-0.5 truncate text-xs font-bold sm:text-sm"
              style={{ color: "var(--strata-debt-borrowed)" }}
            >
              <AmountText minor={summary.totalBorrowedRemainingMinor} currency={baseCurrency} />
            </div>
          </div>

          <div className="col-span-2 min-w-0 sm:col-span-1">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.debts.countsLabel}
            </div>
            <div className="strata-money mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
              {t.plans.debts.countsValue
                .replace("{open}", String(summary.openCount))
                .replace("{closed}", String(summary.closedCount))}
            </div>
          </div>
        </div>

        {summary.overdueCount > 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/80 px-3.5 py-2.5 text-xs">
            <AlertTriangle
              className="h-4 w-4 shrink-0"
              style={{ color: "var(--strata-radar-expired)" }}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--strata-text-primary)]">
              {t.plans.debts.overdueAlertSummary.replace(
                "{count}",
                String(summary.overdueCount)
              )}
            </span>
          </div>
        ) : null}
      </Card>

      {/* Open Debts List */}
      {summary.rows.length === 0 ? (
        <Card className="space-y-3 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--strata-bg-elevated)] text-[var(--strata-text-muted)]">
            <Handshake className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--strata-text-primary)]">
              {t.plans.debts.emptyTitle}
            </h2>
            <p className="mx-auto max-w-md text-xs text-[var(--strata-text-muted)] sm:text-sm">
              {t.plans.debts.emptyBody}
            </p>
          </div>
          <div className="pt-1">
            <Button type="button" onClick={() => onOpenDebtForm(null)}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t.plans.actions.addDebt}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {openRows.length > 0 ? (
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                openRows.length > 1 && "md:grid-cols-2"
              )}
            >
              {openRows.map((row) => {
                const apiDebt = apiDebtMap.get(row.debtId);
                const isLent = row.direction === "lent";
                const accentColor = isLent
                  ? "var(--strata-debt-lent)"
                  : "var(--strata-debt-borrowed)";
                const pct = Math.round(row.progress * 100);
                const lastTxId =
                  row.repaymentTransactionIds[row.repaymentTransactionIds.length - 1];
                const lastTx = lastTxId ? txMap.get(lastTxId) : null;

                return (
                  <Card key={row.debtId} className="flex flex-col justify-between space-y-3.5 p-4">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)]"
                          style={{ color: accentColor }}
                        >
                          {isLent ? (
                            <ArrowUpRight className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-[var(--strata-text-primary)] sm:text-[15px]">
                              {row.counterparty}
                            </span>
                            <Badge tone="default">
                              {isLent
                                ? t.plans.debts.directionLent
                                : t.plans.debts.directionBorrowed}
                            </Badge>
                            {row.isOverdue && row.daysUntilDue !== null ? (
                              <Badge tone="danger">
                                {t.plans.debts.overdueDays.replace(
                                  "{days}",
                                  String(Math.abs(row.daysUntilDue))
                                )}
                              </Badge>
                            ) : row.daysUntilDue !== null && row.daysUntilDue <= 7 ? (
                              <Badge tone="warn">
                                {row.daysUntilDue === 0
                                  ? t.plans.debts.dueToday
                                  : t.plans.debts.dueInDays.replace(
                                      "{days}",
                                      String(row.daysUntilDue)
                                    )}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--strata-text-muted)]">
                            <span>
                              {t.plans.debts.openedOn.replace(
                                "{date}",
                                formatShortDate(row.openedAt)
                              )}
                            </span>
                            {row.dueDate ? (
                              <span>
                                ·{" "}
                                {t.plans.debts.dueOn.replace(
                                  "{date}",
                                  formatShortDate(row.dueDate)
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {apiDebt ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t.capital.actionsLabel}
                              className="h-8 w-8 shrink-0 rounded-xl"
                            >
                              <MoreHorizontal
                                className="h-4 w-4"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={busyId === apiDebt.id}
                              onSelect={() =>
                                void handleCloseManually(
                                  apiDebt,
                                  row.repaidFromTransactionsMinor
                                )
                              }
                            >
                              <Check
                                className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              <span>{t.plans.debts.closeManually}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onOpenDebtForm(apiDebt)}>
                              <Pencil
                                className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span>{t.plans.debts.editDebt}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setDeletingDebt(apiDebt)}
                              className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                              <span>{t.plans.debts.deleteDebt}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>

                    {row.comment ? (
                      <p className="text-xs text-[var(--strata-text-secondary)]">{row.comment}</p>
                    ) : null}

                    {/* Progress & Amounts */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span
                            className="text-lg font-extrabold tracking-tight"
                            style={{ color: accentColor }}
                          >
                            <AmountText minor={row.remainingMinor} currency={baseCurrency} />
                          </span>
                          <span className="text-xs text-[var(--strata-text-muted)]">
                            {t.plans.goals.ofTarget}{" "}
                            <AmountText minor={row.amountMinor} currency={baseCurrency} />
                          </span>
                        </div>
                        <span className="strata-money text-xs font-bold text-[var(--strata-text-secondary)]">
                          {pct}%
                        </span>
                      </div>

                      <div
                        aria-hidden="true"
                        className="h-2 w-full overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]"
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)]">
                      {row.repaidFromTransactionsMinor > 0 ? (
                        <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                          {t.plans.debts.repaidViaTx}:{" "}
                          <AmountText
                            minor={row.repaidFromTransactionsMinor}
                            currency={baseCurrency}
                          />
                        </span>
                      ) : null}
                      {row.manualRepaidMinor > 0 ? (
                        <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                          {t.plans.debts.repaidManual}:{" "}
                          <AmountText minor={row.manualRepaidMinor} currency={baseCurrency} />
                        </span>
                      ) : null}
                      <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                        {t.plans.debts.fifoHint.replace("{name}", row.counterparty)}
                      </span>
                    </div>

                    {/* Action Row */}
                    {apiDebt ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--strata-border-subtle)] pt-2.5">
                        <div className="flex items-center gap-2">
                          {row.repaymentTransactionIds.length > 0 ? (
                            <span className="text-[11px] text-[var(--strata-text-muted)]">
                              {t.plans.debts.matchedTxCount.replace(
                                "{count}",
                                String(row.repaymentTransactionIds.length)
                              )}
                            </span>
                          ) : null}
                          {lastTx ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openQuickAdd({ transaction: lastTx })}
                            >
                              {t.plans.debts.viewLastRepayment}
                            </Button>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            openQuickAdd({
                              type: isLent ? "debt_received_back" : "debt_paid_back",
                              amountMinor: row.remainingMinor,
                              debtId: apiDebt.id,
                              debtCounterparty: apiDebt.counterparty,
                              comment: apiDebt.counterparty,
                            })
                          }
                        >
                          <Handshake className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span>{t.plans.debts.recordRepayment}</span>
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : null}

          {/* Closed Debts Collapsible */}
          {closedRows.length > 0 ? (
            <Card className="space-y-3 p-4">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                aria-expanded={showClosed}
                className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-bold text-[var(--strata-text-secondary)]">
                  {t.plans.debts.closedSectionTitle.replace(
                    "{count}",
                    String(closedRows.length)
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-[var(--strata-text-muted)] transition-transform duration-200",
                    showClosed && "rotate-180"
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>

              {showClosed ? (
                <div className="divide-y divide-[var(--strata-border-subtle)] border-t border-[var(--strata-border-subtle)] pt-2">
                  {closedRows.map((row) => {
                    const apiDebt = apiDebtMap.get(row.debtId);
                    const isLent = row.direction === "lent";
                    return (
                      <div
                        key={row.debtId}
                        className="flex flex-wrap items-center justify-between gap-2.5 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                              {row.counterparty}
                            </span>
                            <Badge tone="ok">{t.plans.debts.closedBadge}</Badge>
                            <Badge tone="default">
                              {isLent
                                ? t.plans.debts.directionLent
                                : t.plans.debts.directionBorrowed}
                            </Badge>
                          </div>
                          <div className="text-xs text-[var(--strata-text-muted)]">
                            <AmountText minor={row.amountMinor} currency={baseCurrency} /> ·{" "}
                            {t.plans.debts.openedOn.replace(
                              "{date}",
                              formatShortDate(row.openedAt)
                            )}
                          </div>
                        </div>

                        {apiDebt ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {row.manualRepaidMinor > 0 ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busyId === apiDebt.id}
                                onClick={() => void handleReopen(apiDebt)}
                              >
                                <RotateCcw
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                  aria-hidden="true"
                                />
                                <span>{t.plans.debts.reopenDebt}</span>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t.plans.debts.deleteDebt}
                              onClick={() => setDeletingDebt(apiDebt)}
                              className="h-8 w-8 rounded-xl text-[var(--strata-text-muted)] hover:text-[var(--strata-money-expense)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingDebt)}
        onOpenChange={(next) => {
          if (!next) setDeletingDebt(null);
        }}
        title={t.plans.debts.deleteDebtTitle}
        description={t.plans.debts.deleteDebtBody}
        confirmLabel={t.common.delete}
        busy={deletingBusy}
        onConfirm={() => void handleDeleteDebt()}
      />
    </div>
  );
}
