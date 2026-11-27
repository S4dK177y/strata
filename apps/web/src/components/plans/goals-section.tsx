"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type { GoalsPortfolioSummary } from "@strata/finance-core";
import type { Account, Goal, GoalTransfer } from "@strata/api-contract";
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

interface GoalsSectionProps {
  baseCurrency: string;
  accounts: Account[];
  goals: Goal[];
  goalTransfers: GoalTransfer[];
  summary: GoalsPortfolioSummary;
  onOpenGoalForm: (goal: Goal | null) => void;
  onOpenTransferDialog: (fromGoalId?: string | null) => void;
  onRefresh: () => Promise<void>;
}

const PRIORITY_BADGE_TONE: Record<Goal["priority"], "warn" | "brand" | "default"> = {
  high: "warn",
  medium: "brand",
  low: "default",
};

export function GoalsSection({
  baseCurrency,
  accounts,
  goals,
  goalTransfers,
  summary,
  onOpenGoalForm,
  onOpenTransferDialog,
  onRefresh,
}: GoalsSectionProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd } = useQuickAdd();

  const [showArchived, setShowArchived] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [deletingTransfer, setDeletingTransfer] = useState<GoalTransfer | null>(null);
  const [busy, setBusy] = useState(false);

  const apiGoalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.deleted_at && a.is_active),
    [accounts]
  );

  const allocationList = useMemo(
    () => Object.values(summary.storageAllocation),
    [summary.storageAllocation]
  );

  function formatRate(decimalRate: number): string {
    const pct = Math.round(decimalRate * 1000) / 10;
    return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      maximumFractionDigits: 2,
    }).format(pct)}%`;
  }

  function formatEstimatedMonth(yearMonth: string): string {
    const [y, m] = yearMonth.split("-").map(Number);
    if (!y || !m) return yearMonth;
    const formatted = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function formatShortDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
    }).format(d);
  }

  function handleContribute(goal: Goal, remainingMinor: number) {
    const storageAcc = goal.storage_account_id ? accountMap.get(goal.storage_account_id) : null;
    const savingsTarget =
      storageAcc &&
      storageAcc.is_active &&
      !storageAcc.deleted_at &&
      (storageAcc.type === "savings" || storageAcc.type === "deposit")
        ? storageAcc
        : activeAccounts.find((a) => a.type === "savings" || a.type === "deposit");

    const nonSavingsSource = activeAccounts.find(
      (a) =>
        a.id !== savingsTarget?.id && a.type !== "savings" && a.type !== "deposit"
    );

    const suggestedMinor =
      goal.monthly_plan_minor > 0 && remainingMinor > 0
        ? Math.min(goal.monthly_plan_minor, remainingMinor)
        : remainingMinor > 0
          ? remainingMinor
          : goal.monthly_plan_minor > 0
            ? goal.monthly_plan_minor
            : undefined;

    if (savingsTarget && nonSavingsSource) {
      openQuickAdd({
        type: "transfer",
        accountFromId: nonSavingsSource.id,
        accountToId: savingsTarget.id,
        goalId: goal.id,
        goalName: goal.name,
        amountMinor: suggestedMinor,
        comment: goal.name,
      });
      return;
    }

    openQuickAdd({
      type: "income",
      accountFromId: storageAcc?.id ?? activeAccounts[0]?.id,
      goalId: goal.id,
      goalName: goal.name,
      amountMinor: suggestedMinor,
      comment: goal.name,
    });
  }

  async function handleToggleArchive(goal: Goal) {
    try {
      const res = await fetch(`/api/v1/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !goal.is_archived }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(goal.is_archived ? t.plans.goals.unarchivedToast : t.plans.goals.archivedToast);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    }
  }

  async function handleDeleteGoal() {
    if (!deletingGoal) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/goals/${deletingGoal.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.goals.deletedToast);
      setDeletingGoal(null);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTransfer() {
    if (!deletingTransfer) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/goal-transfers/${deletingTransfer.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.goals.transferDeletedToast);
      setDeletingTransfer(null);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const overallPct = Math.round(summary.overallProgress * 100);

  return (
    <div className="space-y-5">
      {/* Unified Goals Portfolio Summary Card */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[var(--strata-text-muted)]">
              {t.plans.goals.totalSavedLabel}
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span
                className="text-2xl font-extrabold tracking-tight sm:text-[28px]"
                style={{ color: "var(--strata-goal-envelope)" }}
              >
                <AmountText minor={summary.totalSavedMinor} currency={baseCurrency} />
              </span>
              {summary.totalTargetMinor > 0 ? (
                <span className="text-xs text-[var(--strata-text-muted)] sm:text-sm">
                  {t.plans.goals.ofTarget}{" "}
                  <AmountText minor={summary.totalTargetMinor} currency={baseCurrency} />
                </span>
              ) : null}
            </div>
          </div>

          {summary.activeCount >= 2 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenTransferDialog(null)}
              className="w-full shrink-0 sm:w-auto"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>{t.plans.goals.transferButton}</span>
            </Button>
          ) : null}
        </div>

        <div
          aria-hidden="true"
          className="h-2 w-full overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overallPct}%`,
              backgroundColor: "var(--strata-goal-envelope)",
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[var(--strata-border-subtle)] pt-3.5 sm:grid-cols-3 sm:gap-4">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.goals.remainingLabel}
            </div>
            <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
              <AmountText minor={summary.totalRemainingMinor} currency={baseCurrency} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.goals.monthlyPlanLabel}
            </div>
            <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
              <AmountText minor={summary.totalMonthlyPlanMinor} currency={baseCurrency} />
            </div>
          </div>

          <div className="col-span-2 min-w-0 sm:col-span-1">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.goals.achievedCountLabel}
            </div>
            <div className="strata-money mt-0.5 truncate text-xs font-bold text-[var(--strata-money-income)] sm:text-sm">
              {t.plans.goals.achievedCountValue
                .replace("{done}", String(summary.achievedCount))
                .replace("{total}", String(summary.activeCount))}
            </div>
          </div>
        </div>

        {allocationList.length > 0 ? (
          <div className="space-y-2 border-t border-[var(--strata-border-subtle)] pt-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--strata-text-secondary)]">
              <Wallet className="h-3.5 w-3.5 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              <span>{t.plans.goals.storageAllocationTitle}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allocationList.map((alloc) => {
                const acc = accountMap.get(alloc.accountId);
                const curr = acc?.currency ?? baseCurrency;
                const over = alloc.freeMinor < 0;
                return (
                  <div
                    key={alloc.accountId}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)]/80 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--strata-text-primary)]">
                        {alloc.accountName}
                      </div>
                      <div className="text-[11px] text-[var(--strata-text-muted)]">
                        {t.plans.goals.accountBalanceShort}:{" "}
                        <AmountText minor={alloc.accountBalanceMinor} currency={curr} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-[var(--strata-text-primary)]">
                        {t.plans.goals.allocatedShort}:{" "}
                        <AmountText minor={alloc.allocatedMinor} currency={curr} />
                      </div>
                      <div
                        className={cn(
                          "text-[11px] font-medium",
                          over
                            ? "text-[var(--strata-radar-warn)]"
                            : "text-[var(--strata-money-income)]"
                        )}
                      >
                        {over ? t.plans.goals.overAllocatedShort : t.plans.goals.freeShort}:{" "}
                        <AmountText minor={Math.abs(alloc.freeMinor)} currency={curr} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Active Goal Envelopes Grid */}
      {summary.activeItems.length === 0 ? (
        <Card className="space-y-3 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--strata-bg-elevated)] text-[var(--strata-text-muted)]">
            <Target className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--strata-text-primary)]">
              {t.plans.goals.emptyTitle}
            </h2>
            <p className="mx-auto max-w-md text-xs text-[var(--strata-text-muted)] sm:text-sm">
              {t.plans.goals.emptyBody}
            </p>
          </div>
          <div className="pt-1">
            <Button type="button" onClick={() => onOpenGoalForm(null)}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t.plans.actions.addGoal}
            </Button>
          </div>
        </Card>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            summary.activeItems.length > 1 && "md:grid-cols-2"
          )}
        >
          {summary.activeItems.map(({ goal, envelope, storageAccount }) => {
            const apiGoal = apiGoalMap.get(goal.id);
            const apiStorageAcc = storageAccount ? accountMap.get(storageAccount.id) : null;
            const displayCurrency = apiStorageAcc?.currency ?? baseCurrency;
            const pct = Math.round(envelope.progress * 100);

            return (
              <Card key={goal.id} className="flex flex-col justify-between space-y-3.5 p-4">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)]"
                      style={{
                        color: envelope.isAchieved
                          ? "var(--strata-radar-ok)"
                          : "var(--strata-goal-envelope)",
                      }}
                    >
                      <Target className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[var(--strata-text-primary)] sm:text-[15px]">
                          {goal.name}
                        </span>
                        <Badge tone={PRIORITY_BADGE_TONE[goal.priority]}>
                          {t.plans.goals.priority[goal.priority]}
                        </Badge>
                        {envelope.isAchieved ? (
                          <Badge tone="ok">{t.plans.goals.achievedBadge}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--strata-text-muted)]">
                        <span className="truncate">
                          {storageAccount
                            ? `${t.plans.goals.storageAccountLabel}: ${storageAccount.name}`
                            : t.plans.goals.noStorageAccount}
                        </span>
                        {envelope.effectiveRate > 0 ? (
                          <span className="strata-money font-semibold text-[var(--strata-money-income)]">
                            · {t.plans.goals.rateTag.replace("{rate}", formatRate(envelope.effectiveRate))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {apiGoal ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t.capital.actionsLabel}
                          className="h-8 w-8 shrink-0 rounded-xl"
                        >
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => handleContribute(apiGoal, envelope.remainingMinor)}
                        >
                          <Plus
                            className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{t.plans.goals.contributeButton}</span>
                        </DropdownMenuItem>
                        {summary.activeCount >= 2 ? (
                          <DropdownMenuItem onSelect={() => onOpenTransferDialog(apiGoal.id)}>
                            <ArrowLeftRight
                              className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span>{t.plans.goals.transferButton}</span>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onSelect={() => onOpenGoalForm(apiGoal)}>
                          <Pencil
                            className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{t.plans.goals.editGoal}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void handleToggleArchive(apiGoal)}>
                          <Archive
                            className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{t.plans.goals.archiveGoal}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setDeletingGoal(apiGoal)}
                          className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span>{t.plans.goals.deleteGoal}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                {/* Progress & Amounts */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="text-lg font-extrabold tracking-tight text-[var(--strata-text-primary)]">
                        <AmountText minor={envelope.currentMinor} currency={displayCurrency} />
                      </span>
                      <span className="text-xs text-[var(--strata-text-muted)]">
                        {t.plans.goals.ofTarget}{" "}
                        <AmountText minor={goal.targetAmountMinor} currency={displayCurrency} />
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
                        backgroundColor: envelope.isAchieved
                          ? "var(--strata-radar-ok)"
                          : "var(--strata-goal-envelope)",
                      }}
                    />
                  </div>
                </div>

                {/* Breakdown Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)]">
                  {goal.initialAmountMinor > 0 ? (
                    <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                      {t.plans.goals.fromInitialChip}:{" "}
                      <AmountText minor={goal.initialAmountMinor} currency={displayCurrency} />
                    </span>
                  ) : null}
                  {envelope.fromTransactionsMinor !== 0 ? (
                    <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                      {t.plans.goals.fromTransactionsChip}:{" "}
                      <AmountText
                        minor={envelope.fromTransactionsMinor}
                        currency={displayCurrency}
                        showSign
                      />
                    </span>
                  ) : null}
                  {envelope.fromGoalTransfersMinor !== 0 ? (
                    <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                      {t.plans.goals.fromTransfersChip}:{" "}
                      <AmountText
                        minor={envelope.fromGoalTransfersMinor}
                        currency={displayCurrency}
                        showSign
                      />
                    </span>
                  ) : null}
                </div>

                {/* NPER Forecast & Monthly Plan */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-[var(--strata-bg-elevated)] px-3 py-2.5">
                    <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                      {t.plans.goals.nperTitle}
                    </div>
                    <div className="strata-money mt-0.5 truncate text-sm font-bold text-[var(--strata-text-primary)]">
                      {envelope.isAchieved
                        ? t.plans.goals.nperAchieved
                        : envelope.monthsToGoal !== null && envelope.estimatedYearMonth
                          ? `${t.plans.goals.nperMonths.replace(
                              "{months}",
                              String(envelope.monthsToGoal)
                            )} · ${formatEstimatedMonth(envelope.estimatedYearMonth)}`
                          : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[var(--strata-bg-elevated)] px-3 py-2.5">
                    <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                      {t.plans.goals.monthlyPlanLabel}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-bold text-[var(--strata-text-primary)]">
                      {goal.monthlyPlanMinor > 0 ? (
                        <AmountText minor={goal.monthlyPlanMinor} currency={displayCurrency} />
                      ) : (
                        <span className="text-xs font-medium text-[var(--strata-text-muted)]">
                          {t.plans.goals.nperNoPlan}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Row */}
                {apiGoal ? (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--strata-border-subtle)] pt-2.5">
                    {summary.activeCount >= 2 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenTransferDialog(apiGoal.id)}
                      >
                        <ArrowLeftRight
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span>{t.plans.goals.transferButton}</span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleContribute(apiGoal, envelope.remainingMinor)}
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      <span>{t.plans.goals.contributeButton}</span>
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Internal Goal Transfers */}
      {goalTransfers.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--strata-text-primary)]">
              {t.plans.goals.recentTransfersTitle}
            </h3>
            <p className="text-xs text-[var(--strata-text-muted)]">
              {t.plans.goals.recentTransfersSubtitle}
            </p>
          </div>

          <div className="divide-y divide-[var(--strata-border-subtle)]">
            {goalTransfers.slice(0, 8).map((gt) => {
              const fromName =
                apiGoalMap.get(gt.from_goal_id)?.name ?? t.plans.goals.deletedGoalFallback;
              const toName =
                apiGoalMap.get(gt.to_goal_id)?.name ?? t.plans.goals.deletedGoalFallback;
              return (
                <div
                  key={gt.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-[var(--strata-text-primary)]">
                      {fromName} → {toName}
                    </div>
                    <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                      {formatShortDateTime(gt.occurred_at)}
                      {gt.comment ? ` · ${gt.comment}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--strata-goal-envelope)" }}
                    >
                      <AmountText minor={gt.amount_minor} currency={baseCurrency} />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.plans.goals.deleteTransferAria}
                      onClick={() => setDeletingTransfer(gt)}
                      className="h-8 w-8 rounded-xl text-[var(--strata-text-muted)] hover:text-[var(--strata-money-expense)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Archived Goals Collapsible */}
      {summary.archivedItems.length > 0 ? (
        <Card className="space-y-3 p-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
          >
            <span className="text-sm font-bold text-[var(--strata-text-secondary)]">
              {t.plans.goals.archivedTitle.replace(
                "{count}",
                String(summary.archivedItems.length)
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[var(--strata-text-muted)] transition-transform duration-200",
                showArchived && "rotate-180"
              )}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </button>

          {showArchived ? (
            <div className="divide-y divide-[var(--strata-border-subtle)] border-t border-[var(--strata-border-subtle)] pt-2">
              {summary.archivedItems.map(({ goal, envelope, storageAccount }) => {
                const apiGoal = apiGoalMap.get(goal.id);
                const apiStorageAcc = storageAccount ? accountMap.get(storageAccount.id) : null;
                const curr = apiStorageAcc?.currency ?? baseCurrency;
                return (
                  <div
                    key={goal.id}
                    className="flex flex-wrap items-center justify-between gap-2.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                          {goal.name}
                        </span>
                        <Badge tone="default">{t.plans.goals.archivedBadge}</Badge>
                      </div>
                      <div className="text-xs text-[var(--strata-text-muted)]">
                        <AmountText minor={envelope.currentMinor} currency={curr} />{" "}
                        {t.plans.goals.ofTarget}{" "}
                        <AmountText minor={goal.targetAmountMinor} currency={curr} />
                      </div>
                    </div>

                    {apiGoal ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleToggleArchive(apiGoal)}
                        >
                          <ArchiveRestore
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span>{t.plans.goals.unarchiveGoal}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t.plans.goals.deleteGoal}
                          onClick={() => setDeletingGoal(apiGoal)}
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

      {/* Storage hint if any allocation is negative */}
      {allocationList.some((a) => a.freeMinor < 0) ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-3.5 py-2.5 text-xs text-[var(--strata-radar-warn)]">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{t.plans.goals.storageAllocationTitle}</span>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingGoal)}
        onOpenChange={(next) => {
          if (!next) setDeletingGoal(null);
        }}
        title={t.plans.goals.deleteGoalTitle}
        description={t.plans.goals.deleteGoalBody}
        confirmLabel={t.common.delete}
        busy={busy}
        onConfirm={() => void handleDeleteGoal()}
      />

      <ConfirmDialog
        open={Boolean(deletingTransfer)}
        onOpenChange={(next) => {
          if (!next) setDeletingTransfer(null);
        }}
        title={t.plans.goals.deleteTransferTitle}
        description={t.plans.goals.deleteTransferBody}
        confirmLabel={t.common.delete}
        busy={busy}
        onConfirm={() => void handleDeleteTransfer()}
      />
    </div>
  );
}
