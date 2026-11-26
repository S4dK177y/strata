"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
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
import type {
  Account,
  Category,
  Debt,
  Profile,
  Transaction,
} from "@strata/api-contract";
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
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(selectedYear, selectedMonth - 1, 1));
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

  const savingsRateFormatted = useMemo(() => {
    const pct = Math.round(metrics.periodSummary.savingsRate * 1000) / 10;
    return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      maximumFractionDigits: 1,
    }).format(pct)}%`;
  }, [metrics.periodSummary.savingsRate, locale]);

  return (
    <div className="space-y-6">
      {/* Open Aurora Balance Header */}
      <section
        data-tour="hero-balance"
        className="strata-aurora-hero space-y-6 rounded-[28px] p-5 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="text-xs font-medium text-[var(--strata-text-secondary)]">
              {t.dashboard.netWorth}
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={togglePrivacyBlur}
                aria-label={t.privacy.label}
                aria-pressed={privacyBlur}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--strata-text-secondary)] transition hover:bg-black/5 hover:text-[var(--strata-text-primary)] dark:hover:bg-white/10"
              >
                {privacyBlur ? (
                  <EyeOff className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
              <div className="min-w-0 overflow-visible break-words text-[26px] leading-tight font-extrabold tracking-tight text-[var(--strata-text-primary)] sm:text-5xl">
                <AmountText
                  minor={metrics.netWorth}
                  currency={profile.base_currency}
                  alwaysShowDecimals
                />
              </div>
            </div>
          </div>

          <Link href="/capital?tab=categories">
            <Badge className="strata-frosted border-[var(--strata-border-subtle)] px-3 py-1 transition hover:brightness-105">
              {t.dashboard.categoriesCount}: {categories.length}
            </Badge>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="strata-frosted inline-flex items-center gap-2 overflow-visible rounded-full px-4 py-1.5 font-medium text-[var(--strata-text-primary)]">
            <span className="text-[var(--strata-text-secondary)]">{t.dashboard.safeToSpend}:</span>
            <AmountText
              minor={metrics.safeToSpend}
              currency={profile.base_currency}
              className="font-bold"
            />
          </span>
          <span className="text-[var(--strata-text-muted)]">{t.dashboard.safeToSpendNote}</span>
        </div>

        {/* 3 Frosted Squircle Quick Action Tiles */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="strata-frosted flex min-h-20 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] p-2.5 text-center transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:p-3"
          >
            <Plus
              className="h-5 w-5 shrink-0 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="max-w-full truncate text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.quickAdd}
            </span>
          </button>

          <Link
            href="/operations"
            className="strata-frosted flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-[22px] p-2.5 text-center transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:p-3"
          >
            <ArrowLeftRight
              className="h-5 w-5 shrink-0 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="max-w-full truncate text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.operations}
            </span>
          </Link>

          <Link
            href="/settings"
            className="strata-frosted flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-[22px] p-2.5 text-center transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:p-3"
          >
            <SlidersHorizontal
              className="h-5 w-5 shrink-0 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="max-w-full truncate text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.settings}
            </span>
          </Link>
        </div>
      </section>

      {/* Period Selector & Cashflow KPI Strip + Analytics */}
      <section data-tour="analytics-charts" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.dashboard.analytics.prevPeriod}
              onClick={() => shiftPeriod(-1)}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
            <span className="min-w-28 px-2 text-center text-sm font-bold capitalize text-[var(--strata-text-primary)] sm:min-w-36">
              {periodLabel}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.dashboard.analytics.nextPeriod}
              onClick={() => shiftPeriod(1)}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>

            {!isCurrentPeriod ? (
              <button
                type="button"
                onClick={resetToCurrentPeriod}
                className="ml-1 min-h-9 cursor-pointer rounded-full border border-[var(--strata-border-subtle)] px-3 text-xs font-semibold text-[var(--strata-accent-brand)] transition hover:border-[var(--strata-border-strong)]"
              >
                {t.dashboard.analytics.currentPeriod}
              </button>
            ) : null}
          </div>

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
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
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

        <CashflowTrendChart
          series={metrics.monthlySeries}
          year={selectedYear}
          baseCurrency={profile.base_currency}
        />

        <CategoryBreakdownCard
          items={metrics.categoryBreakdown}
          categories={categories}
          baseCurrency={profile.base_currency}
          periodLabel={periodLabel}
        />
      </section>

      {/* Grouped Matte Accounts Section Card */}
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

      {/* Recent Operations Card */}
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
    </div>
  );
}
