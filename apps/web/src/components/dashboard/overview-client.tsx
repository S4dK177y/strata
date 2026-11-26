"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardSectionIdSchema,
  type Account,
  type Category,
  type DashboardSectionId,
  type Debt,
  type Profile,
  type Transaction,
} from "@strata/api-contract";
import {
  computeAllAccountBalances,
  computeCategoryBreakdown,
  computeCreditCardAvailable,
  computeDebtsLedger,
  computeMonthlySeries,
  computeNetWorth,
  computePeriodSummary,
  computeSafeToSpend,
} from "@strata/finance-core";
import { CashflowTrendChart } from "@/components/dashboard/cashflow-trend-chart";
import { CategoryBreakdownCard } from "@/components/dashboard/category-breakdown-card";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ACCOUNT_TYPE_ICONS,
  getCategoryIcon,
  TRANSACTION_TYPE_META,
} from "@/lib/category-icons";
import {
  toCoreAccount,
  toCoreCategory,
  toCoreDebt,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface OverviewClientProps {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  currentYear: number;
  currentMonth: number;
}

function normalizeDashboardLayout(raw: string[] | null | undefined): DashboardSectionId[] {
  const result: DashboardSectionId[] = [];
  const seen = new Set<DashboardSectionId>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = DashboardSectionIdSchema.safeParse(item);
      if (parsed.success && !seen.has(parsed.data)) {
        seen.add(parsed.data);
        result.push(parsed.data);
      }
    }
  }

  for (const fallback of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(fallback)) {
      seen.add(fallback);
      result.push(fallback);
    }
  }

  return result;
}

export function OverviewClient({
  profile,
  accounts,
  categories,
  transactions,
  debts,
  currentYear,
  currentMonth,
}: OverviewClientProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { privacyBlur, togglePrivacyBlur } = usePrivacy();
  const { openQuickAdd, registerOnMutated } = useQuickAdd();

  const [periodMode, setPeriodMode] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [layoutOrder, setLayoutOrder] = useState<DashboardSectionId[]>(() =>
    normalizeDashboardLayout(profile.dashboard_layout)
  );
  const [editingLayout, setEditingLayout] = useState(false);
  const [draggingId, setDraggingId] = useState<DashboardSectionId | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);

  useEffect(() => {
    return registerOnMutated(() => {
      router.refresh();
    });
  }, [registerOnMutated, router]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && !a.deleted_at),
    [accounts]
  );

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const metrics = useMemo(() => {
    const coreAccounts = accounts.map(toCoreAccount);
    const coreCats = categories.map(toCoreCategory);
    const coreTxs = transactions.map(toCoreTransaction);
    const coreDebts = debts.map(toCoreDebt);

    const balances = computeAllAccountBalances(coreAccounts, coreTxs);
    const debtLedger = computeDebtsLedger(coreDebts, coreTxs);
    const netWorth = computeNetWorth(
      coreAccounts,
      balances,
      debtLedger.totalBorrowedRemainingMinor
    );
    const safeToSpend = computeSafeToSpend(coreAccounts, balances, 0);
    const monthFilter = periodMode === "month" ? selectedMonth : null;
    const periodSummary = computePeriodSummary(coreTxs, selectedYear, monthFilter);
    const categoryBreakdown = computeCategoryBreakdown(
      coreCats,
      coreTxs,
      selectedYear,
      monthFilter
    );
    const monthlySeries = computeMonthlySeries(coreAccounts, coreTxs, coreDebts, selectedYear);

    return {
      balances,
      netWorth,
      safeToSpend,
      periodSummary,
      categoryBreakdown,
      monthlySeries,
    };
  }, [accounts, categories, transactions, debts, periodMode, selectedYear, selectedMonth]);

  const recentTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);

  const periodLabel = useMemo(() => {
    if (periodMode === "year") return String(selectedYear);
    const formatted = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(selectedYear, selectedMonth - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [periodMode, selectedYear, selectedMonth, locale]);

  const isCurrentPeriod =
    periodMode === "year"
      ? selectedYear === currentYear
      : selectedYear === currentYear && selectedMonth === currentMonth;

  function shiftPeriod(delta: number) {
    if (periodMode === "year") {
      setSelectedYear((y) => y + delta);
      return;
    }
    const next = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth() + 1);
  }

  function resetToCurrentPeriod() {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
  }

  async function persistLayout(nextOrder: DashboardSectionId[]) {
    setSavingLayout(true);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_layout: nextOrder }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
      }
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSavingLayout(false);
    }
  }

  function moveSectionBy(index: number, delta: -1 | 1) {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= layoutOrder.length) return;
    const next = [...layoutOrder];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIdx, 0, moved);
    setLayoutOrder(next);
    void persistLayout(next);
  }

  function reorderSection(sourceId: DashboardSectionId, targetId: DashboardSectionId) {
    if (sourceId === targetId) return;
    const fromIdx = layoutOrder.indexOf(sourceId);
    const toIdx = layoutOrder.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...layoutOrder];
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    setLayoutOrder(next);
    void persistLayout(next);
  }

  function resetLayoutOrder() {
    const defaults = [...DEFAULT_DASHBOARD_LAYOUT];
    setLayoutOrder(defaults);
    void persistLayout(defaults);
    toast.success(t.dashboard.layout.resetToast);
  }

  const savingsRateFormatted = useMemo(() => {
    const pct = Math.round(metrics.periodSummary.savingsRate * 1000) / 10;
    return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      maximumFractionDigits: 1,
    }).format(pct)}%`;
  }, [metrics.periodSummary.savingsRate, locale]);

  function renderSectionContent(sectionId: DashboardSectionId): ReactNode {
    switch (sectionId) {
      case "analytics_kpis":
        return (
          <div data-tour="analytics-charts" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <Card className="min-w-0 p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.dashboard.monthIncome}
              </div>
              <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-money-income)] sm:text-lg">
                <AmountText
                  minor={metrics.periodSummary.totalIncomeMinor}
                  currency={profile.base_currency}
                  showSign
                />
              </div>
              {metrics.periodSummary.passiveIncomeMinor > 0 ? (
                <div className="mt-0.5 truncate text-[11px] text-[var(--strata-text-muted)]">
                  {t.dashboard.analytics.passiveShort}:{" "}
                  <AmountText
                    minor={metrics.periodSummary.passiveIncomeMinor}
                    currency={profile.base_currency}
                  />
                </div>
              ) : null}
            </Card>

            <Card className="min-w-0 p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.dashboard.monthExpense}
              </div>
              <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-money-expense)] sm:text-lg">
                <AmountText
                  minor={
                    metrics.periodSummary.netExpenseMinor > 0
                      ? -metrics.periodSummary.netExpenseMinor
                      : 0
                  }
                  currency={profile.base_currency}
                />
              </div>
              {metrics.periodSummary.compensationMinor > 0 ? (
                <div className="mt-0.5 truncate text-[11px] text-[var(--strata-money-compensation)]">
                  {t.dashboard.analytics.refundOffset}:{" "}
                  <AmountText
                    minor={metrics.periodSummary.compensationMinor}
                    currency={profile.base_currency}
                  />
                </div>
              ) : null}
            </Card>

            <Card className="min-w-0 p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.dashboard.monthSaldo}
              </div>
              <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-text-primary)] sm:text-lg">
                <AmountText
                  minor={metrics.periodSummary.netBalanceMinor}
                  currency={profile.base_currency}
                  showSign
                />
              </div>
            </Card>

            <Card className="min-w-0 p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.dashboard.analytics.savingsRate}
              </div>
              <div
                className={cn(
                  "strata-money mt-1 text-base font-bold sm:text-lg",
                  metrics.periodSummary.savingsRate > 0
                    ? "text-[var(--strata-money-income)]"
                    : metrics.periodSummary.savingsRate < 0
                      ? "text-[var(--strata-money-expense)]"
                      : "text-[var(--strata-text-primary)]"
                )}
              >
                {savingsRateFormatted}
              </div>
            </Card>
          </div>
        );

      case "cashflow_trend":
        return (
          <CashflowTrendChart
            series={metrics.monthlySeries}
            year={selectedYear}
            baseCurrency={profile.base_currency}
          />
        );

      case "category_breakdown":
        return (
          <CategoryBreakdownCard
            items={metrics.categoryBreakdown}
            categories={categories}
            baseCurrency={profile.base_currency}
            periodLabel={periodLabel}
          />
        );

      case "accounts":
        return (
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
                {t.dashboard.accountsTitle}
              </h2>
              <Link
                href="/capital"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--strata-accent-brand)] hover:underline"
              >
                {t.dashboard.manageAccounts}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>

            {activeAccounts.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                <span>{t.dashboard.noAccounts}</span>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/capital">{t.dashboard.addFirstAccount}</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--strata-border-subtle)]">
                {activeAccounts.map((acc) => {
                  const balance = metrics.balances[acc.id] ?? acc.initial_balance_minor;
                  const AccountIcon = ACCOUNT_TYPE_ICONS[acc.type] ?? Wallet;
                  const creditAvailable =
                    acc.type === "credit" && acc.credit_limit_minor > 0
                      ? computeCreditCardAvailable(toCoreAccount(acc), balance)
                      : null;

                  return (
                    <Link
                      key={acc.id}
                      href={`/operations?account=${acc.id}`}
                      className="flex min-h-14 items-center justify-between gap-4 py-3 transition first:pt-1 last:pb-1 hover:opacity-85"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                          <AccountIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                            {acc.name}
                          </div>
                          <div className="text-xs text-[var(--strata-text-muted)]">
                            {t.onboarding.accountTypes[acc.type]}
                            {creditAvailable !== null ? (
                              <span>
                                {" "}
                                · {t.dashboard.creditAvailableLabel}:{" "}
                                <AmountText minor={creditAvailable} currency={acc.currency} />
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 whitespace-nowrap text-right text-base font-bold text-[var(--strata-text-primary)]">
                        <AmountText minor={balance} currency={acc.currency} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        );

      case "recent_operations":
        return (
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
                {t.dashboard.recentOperationsTitle}
              </h2>
              <Link
                href="/operations"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--strata-accent-brand)] hover:underline"
              >
                {t.dashboard.allOperations}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                <span>{t.dashboard.noOperations}</span>
                <Button type="button" size="sm" onClick={() => openQuickAdd()}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {t.nav.quickAdd}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--strata-border-subtle)]">
                {recentTransactions.map((tx) => {
                  const meta = TRANSACTION_TYPE_META[tx.type];
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : null;
                  const fromAcc = tx.account_from_id ? accountMap.get(tx.account_from_id) : null;
                  const toAcc = tx.account_to_id ? accountMap.get(tx.account_to_id) : null;
                  const Icon = category ? getCategoryIcon(category.icon) : meta.icon;
                  const signedMinor = meta.sign === "-" ? -tx.amount_minor : tx.amount_minor;
                  const displayCurrency = fromAcc?.currency ?? profile.base_currency;

                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => openQuickAdd({ transaction: tx })}
                      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left transition first:pt-1 last:pb-1 hover:opacity-85"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                              {category?.name ?? t.transactions.types[tx.type]}
                            </span>
                            {tx.status === "draft" ? (
                              <Badge tone="warn">{t.transactions.draftBadge}</Badge>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-[var(--strata-text-muted)]">
                            {tx.type === "transfer"
                              ? `${fromAcc?.name ?? t.transactions.filters.unknownAccount} → ${toAcc?.name ?? t.transactions.filters.unknownAccount}`
                              : fromAcc?.name ?? t.transactions.noAccountOption}
                            {tx.comment ? ` · ${tx.comment}` : ""}
                          </div>
                        </div>
                      </div>
                      <div
                        className="shrink-0 whitespace-nowrap text-right text-base font-bold"
                        style={{ color: meta.colorVar }}
                      >
                        <AmountText
                          minor={signedMinor}
                          currency={displayCurrency}
                          showSign={meta.sign === "+"}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Pinned Open Aurora Balance Header (Variant C) */}
      <section
        data-tour="hero-balance"
        className="strata-aurora-hero rounded-[28px] p-4 sm:p-6 lg:p-7"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 lg:justify-start">
              <span className="text-xs font-medium text-[var(--strata-text-secondary)]">
                {t.dashboard.netWorth}
              </span>
              <button
                type="button"
                onClick={togglePrivacyBlur}
                aria-label={t.privacy.label}
                aria-pressed={privacyBlur}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--strata-text-secondary)] transition hover:bg-black/5 hover:text-[var(--strata-text-primary)] dark:hover:bg-white/10"
              >
                {privacyBlur ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="mt-1 min-w-0 overflow-visible break-words text-[30px] leading-tight font-extrabold tracking-tight text-[var(--strata-text-primary)] sm:text-4xl lg:text-[42px]">
              <AmountText
                minor={metrics.netWorth}
                currency={profile.base_currency}
                alwaysShowDecimals
              />
            </div>
            <div className="mt-1.5 hidden text-xs text-[var(--strata-text-muted)] lg:block">
              {t.dashboard.safeToSpendNote}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--strata-border-subtle)] pt-3.5 lg:w-[440px] lg:shrink-0 lg:gap-3.5 lg:border-t-0 lg:pt-0">
            <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]/55 px-3.5 py-3 lg:px-5 lg:py-4">
              <div className="truncate text-[11px] font-medium text-[var(--strata-text-secondary)] lg:text-xs">
                {t.dashboard.safeToSpend}
              </div>
              <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-text-primary)] lg:mt-1.5 lg:text-xl">
                <AmountText minor={metrics.safeToSpend} currency={profile.base_currency} />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]/55 px-3.5 py-3 lg:px-5 lg:py-4">
              <div className="truncate text-[11px] font-medium text-[var(--strata-text-secondary)] lg:text-xs">
                {periodMode === "month"
                  ? t.dashboard.periodNetMonth
                  : t.dashboard.periodNetYear}
              </div>
              <div
                className={cn(
                  "mt-1 overflow-visible text-base font-bold lg:mt-1.5 lg:text-xl",
                  metrics.periodSummary.netBalanceMinor > 0
                    ? "text-[var(--strata-money-income)]"
                    : metrics.periodSummary.netBalanceMinor < 0
                      ? "text-[var(--strata-money-expense)]"
                      : "text-[var(--strata-text-primary)]"
                )}
              >
                <AmountText
                  minor={metrics.periodSummary.netBalanceMinor}
                  currency={profile.base_currency}
                  showSign
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Period Selector & Layout Customize Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t.dashboard.analytics.prevPeriod}
            onClick={() => shiftPeriod(-1)}
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
                onClick={resetToCurrentPeriod}
                className="min-h-8 shrink-0 cursor-pointer rounded-full border border-[var(--strata-border-subtle)] px-2.5 text-xs font-semibold text-[var(--strata-accent-brand)] transition hover:border-[var(--strata-border-strong)]"
              >
                {t.dashboard.analytics.currentPeriod}
              </button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t.dashboard.analytics.nextPeriod}
            onClick={() => shiftPeriod(1)}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <div
            role="tablist"
            aria-label={t.dashboard.analytics.periodModeLabel}
            className="inline-flex rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={periodMode === "month"}
              onClick={() => setPeriodMode("month")}
              className={cn(
                "min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
                periodMode === "month"
                  ? "bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                  : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
              )}
            >
              {t.dashboard.analytics.periodMonth}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodMode === "year"}
              onClick={() => setPeriodMode("year")}
              className={cn(
                "min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
                periodMode === "year"
                  ? "bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                  : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
              )}
            >
              {t.dashboard.analytics.periodYear}
            </button>
          </div>

          <Button
            type="button"
            variant={editingLayout ? "primary" : "secondary"}
            size="sm"
            aria-pressed={editingLayout}
            onClick={() => setEditingLayout((v) => !v)}
          >
            {editingLayout ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span>{editingLayout ? t.dashboard.layout.done : t.dashboard.layout.customize}</span>
          </Button>
        </div>
      </div>

      {editingLayout ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--strata-border-glow)] bg-[var(--strata-bg-elevated)]/80 p-3.5">
          <div className="min-w-0 flex-1 text-xs text-[var(--strata-text-secondary)]">
            {t.dashboard.layout.hint}
            {savingLayout ? ` (${t.common.saving})` : ""}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetLayoutOrder}>
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t.dashboard.layout.reset}
            </Button>
            <Button type="button" size="sm" onClick={() => setEditingLayout(false)}>
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              {t.dashboard.layout.done}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Reorderable Overview Cards */}
      <div className="space-y-6">
        {layoutOrder.map((sectionId, idx) => {
          const sectionTitle = t.dashboard.layout.sections[sectionId];
          if (!editingLayout) {
            return (
              <div key={sectionId} data-overview-section={sectionId}>
                {renderSectionContent(sectionId)}
              </div>
            );
          }

          return (
            <div
              key={sectionId}
              data-overview-section={sectionId}
              draggable
              onDragStart={() => setDraggingId(sectionId)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) {
                  reorderSection(draggingId, sectionId);
                }
                setDraggingId(null);
              }}
              onDragEnd={() => setDraggingId(null)}
              className={cn(
                "space-y-2 rounded-3xl border-2 border-dashed p-2.5 transition",
                draggingId === sectionId
                  ? "border-[var(--strata-accent-brand)] opacity-60"
                  : "border-[var(--strata-border-strong)]"
              )}
            >
              <div className="flex items-center justify-between gap-2 px-1.5">
                <div className="flex min-w-0 cursor-grab items-center gap-2 text-xs font-bold text-[var(--strata-text-primary)] active:cursor-grabbing">
                  <GripVertical
                    className="h-4 w-4 shrink-0 text-[var(--strata-text-muted)]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="truncate">{sectionTitle}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={idx === 0}
                    aria-label={t.dashboard.layout.moveUp.replace("{section}", sectionTitle)}
                    onClick={() => moveSectionBy(idx, -1)}
                    className="h-8 w-8"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={idx === layoutOrder.length - 1}
                    aria-label={t.dashboard.layout.moveDown.replace("{section}", sectionTitle)}
                    onClick={() => moveSectionBy(idx, 1)}
                    className="h-8 w-8"
                  >
                    <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {renderSectionContent(sectionId)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
