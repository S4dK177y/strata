"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Eye,
  EyeOff,
  Plus,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import {
  computeAllAccountBalances,
  computeCreditCardAvailable,
  computeDebtsLedger,
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
  toCoreDebt,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";

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
  const { t } = useI18n();
  const { privacyBlur, togglePrivacyBlur } = usePrivacy();
  const { openQuickAdd } = useQuickAdd();

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && !a.deleted_at),
    [accounts]
  );

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const metrics = useMemo(() => {
    const coreAccounts = accounts.map(toCoreAccount);
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
    const monthSummary = computePeriodSummary(coreTxs, currentYear, currentMonth);
    return { balances, netWorth, safeToSpend, monthSummary };
  }, [accounts, transactions, debts, currentYear, currentMonth]);

  const recentTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);

  return (
    <div className="space-y-6">
      {/* Open Aurora Balance Header */}
      <section className="strata-aurora-hero space-y-6 rounded-[28px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-[var(--strata-text-secondary)]">
              {t.dashboard.netWorth}
            </div>
            <div className="flex items-center gap-3">
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
              <div className="text-3xl font-extrabold tracking-tight text-[var(--strata-text-primary)] sm:text-5xl">
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
          <span className="strata-frosted inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium text-[var(--strata-text-primary)]">
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
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="strata-frosted flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center transition hover:brightness-105 active:scale-[0.98]"
          >
            <Plus
              className="h-5 w-5 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.quickAdd}
            </span>
          </button>

          <Link
            href="/operations"
            className="strata-frosted flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center transition hover:brightness-105"
          >
            <ArrowLeftRight
              className="h-5 w-5 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.operations}
            </span>
          </Link>

          <Link
            href="/settings"
            className="strata-frosted flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center transition hover:brightness-105"
          >
            <SlidersHorizontal
              className="h-5 w-5 text-[var(--strata-text-primary)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.settings}
            </span>
          </Link>
        </div>
      </section>

      {/* This Month Cashflow Snapshot */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium text-[var(--strata-text-muted)]">
            {t.dashboard.monthIncome}
          </div>
          <div className="mt-1 text-lg font-bold text-[var(--strata-money-income)]">
            <AmountText
              minor={metrics.monthSummary.totalIncomeMinor}
              currency={profile.base_currency}
              showSign
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-[var(--strata-text-muted)]">
            {t.dashboard.monthExpense}
          </div>
          <div className="mt-1 text-lg font-bold text-[var(--strata-money-expense)]">
            <AmountText
              minor={
                metrics.monthSummary.netExpenseMinor > 0
                  ? -metrics.monthSummary.netExpenseMinor
                  : 0
              }
              currency={profile.base_currency}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-[var(--strata-text-muted)]">
            {t.dashboard.monthSaldo}
          </div>
          <div className="mt-1 text-lg font-bold text-[var(--strata-text-primary)]">
            <AmountText
              minor={metrics.monthSummary.netBalanceMinor}
              currency={profile.base_currency}
              showSign
            />
          </div>
        </Card>
      </div>

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
                  <div className="shrink-0 text-right text-base font-bold text-[var(--strata-text-primary)]">
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
                    className="shrink-0 text-right text-base font-bold"
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
