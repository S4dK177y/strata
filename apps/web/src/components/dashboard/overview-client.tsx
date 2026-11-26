"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  Calculator,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Layers,
  PiggyBank,
  Plus,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import {
  computeAllAccountBalances,
  computeDebtsLedger,
  computeNetWorth,
  computeSafeToSpend,
  evaluateAmountExpression,
  type Account,
  type Debt,
  type Transaction,
} from "@strata/finance-core";
import type { Profile } from "@strata/api-contract";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";

interface OverviewClientProps {
  profile: Profile;
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  categoriesCount: number;
}

const ACCOUNT_ICONS = {
  debit: CreditCard,
  credit: CreditCard,
  cash: Banknote,
  savings: PiggyBank,
  deposit: Landmark,
} as const;

export function OverviewClient({
  profile,
  accounts,
  transactions,
  debts,
  categoriesCount,
}: OverviewClientProps) {
  const { t } = useI18n();
  const { privacyBlur, togglePrivacyBlur } = usePrivacy();
  const [calcInput, setCalcInput] = useState("=320+185");

  const metrics = useMemo(() => {
    const balances = computeAllAccountBalances(accounts, transactions);
    const debtLedger = computeDebtsLedger(debts, transactions);
    const netWorth = computeNetWorth(
      accounts,
      balances,
      debtLedger.totalBorrowedRemainingMinor
    );
    const safeToSpend = computeSafeToSpend(accounts, balances, 0);
    return { balances, netWorth, safeToSpend };
  }, [accounts, transactions, debts]);

  const parsedMinor = useMemo(() => evaluateAmountExpression(calcInput), [calcInput]);

  return (
    <div className="space-y-6">
      {/* Open Aurora Balance Header (Sber-inspired) */}
      <section className="strata-aurora-hero rounded-[28px] p-6 sm:p-8 space-y-6">
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

          <Badge className="strata-frosted border-[var(--strata-border-subtle)] px-3 py-1">
            {t.dashboard.categoriesCount}: {categoriesCount}
          </Badge>
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
          <div
            aria-disabled="true"
            title={t.common.comingSoon}
            className="strata-frosted flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center opacity-60"
          >
            <Plus className="h-5 w-5 text-[var(--strata-text-primary)]" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.quickAdd}
            </span>
          </div>

          <div
            aria-disabled="true"
            title={t.common.comingSoon}
            className="strata-frosted flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center opacity-60"
          >
            <ArrowLeftRight className="h-5 w-5 text-[var(--strata-text-primary)]" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.operations}
            </span>
          </div>

          <Link
            href="/settings"
            className="strata-frosted flex min-h-20 flex-col items-center justify-center gap-2 rounded-[22px] p-3 text-center transition hover:brightness-105"
          >
            <SlidersHorizontal className="h-5 w-5 text-[var(--strata-text-primary)]" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--strata-text-primary)]">
              {t.nav.settings}
            </span>
          </Link>
        </div>
      </section>

      {/* Grouped Matte Accounts Section Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.dashboard.accountsTitle}
          </h2>
          <span className="strata-mono text-xs text-[var(--strata-text-muted)]">
            {accounts.length}
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
            {t.dashboard.noAccounts}
          </div>
        ) : (
          <div className="divide-y divide-[var(--strata-border-subtle)]">
            {accounts.map((acc) => {
              const balance = metrics.balances[acc.id] ?? acc.initialBalanceMinor;
              const AccountIcon = ACCOUNT_ICONS[acc.type] ?? Wallet;
              return (
                <div
                  key={acc.id}
                  className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-1 last:pb-1"
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
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-base font-bold text-[var(--strata-text-primary)]">
                    <AmountText minor={balance} currency={profile.base_currency} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Add Calculator sandbox */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="strata-calc" className="flex items-center gap-2 text-sm font-semibold text-[var(--strata-text-primary)]">
            <Calculator className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            {t.dashboard.calculatorTitle}
          </Label>
          <span className="flex items-center gap-1.5 text-xs text-[var(--strata-text-muted)]">
            <Layers className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {t.dashboard.pr4Notice}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="strata-calc"
            value={calcInput}
            onChange={(e) => setCalcInput(e.target.value)}
            placeholder={t.dashboard.calculatorPlaceholder}
            className="flex-1"
          />
          <div className="min-h-11 rounded-2xl bg-[var(--strata-bg-elevated)] px-4 py-2.5 text-sm font-semibold">
            {parsedMinor !== null ? (
              <span className="text-[var(--strata-money-income)]">
                {t.dashboard.calculatorParsed}:{" "}
                <AmountText minor={parsedMinor} currency={profile.base_currency} mutedFraction={false} />
              </span>
            ) : (
              <span className="text-[var(--strata-money-expense)]">
                {t.dashboard.calculatorInvalid}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
