"use client";

import { useMemo, useState } from "react";
import { Calculator, Layers, Wallet } from "lucide-react";
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

export function OverviewClient({
  profile,
  accounts,
  transactions,
  debts,
  categoriesCount,
}: OverviewClientProps) {
  const { t } = useI18n();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.dashboard.greeting}
          </h1>
          <p className="text-xs text-[var(--strata-text-muted)]">{t.common.tagline}</p>
        </div>
        <Badge tone="default">
          {t.dashboard.categoriesCount}: {categoriesCount}
        </Badge>
      </div>

      {/* Expressive Neobank Hero Card */}
      <section className="strata-hero rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium opacity-80">{t.dashboard.netWorth}</div>
            <div className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              <AmountText
                minor={metrics.netWorth}
                currency={profile.base_currency}
              />
            </div>
          </div>
          <Badge tone="default" className="border-white/20 bg-white/15 text-white">
            {profile.base_currency}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-sm">
          <div>
            <span className="opacity-80">{t.dashboard.safeToSpend}: </span>
            <AmountText
              minor={metrics.safeToSpend}
              currency={profile.base_currency}
              className="font-bold"
            />
          </div>
          <span className="text-xs opacity-75">{t.dashboard.safeToSpendNote}</span>
        </div>
      </section>

      {/* Accounts grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--strata-text-primary)]">
            <Wallet className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            {t.dashboard.accountsTitle}
          </h2>
          <span className="strata-mono text-xs text-[var(--strata-text-muted)]">
            {accounts.length}
          </span>
        </div>

        {accounts.length === 0 ? (
          <Card className="p-5 text-sm text-[var(--strata-text-muted)]">
            {t.dashboard.noAccounts}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const balance = metrics.balances[acc.id] ?? acc.initialBalanceMinor;
              return (
                <Card key={acc.id} className="space-y-2 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                      {acc.name}
                    </span>
                    <Badge>{t.onboarding.accountTypes[acc.type]}</Badge>
                  </div>
                  <div className="text-xl font-bold text-[var(--strata-text-primary)]">
                    <AmountText minor={balance} currency={profile.base_currency} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Add Calculator sandbox */}
      <Card className="space-y-3 p-5 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="strata-calc" className="flex items-center gap-2 text-sm font-semibold">
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
          <div className="min-h-11 rounded-xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)] px-4 py-2.5 text-sm font-semibold">
            {parsedMinor !== null ? (
              <span className="text-[var(--strata-money-income)]">
                {t.dashboard.calculatorParsed}:{" "}
                <AmountText minor={parsedMinor} currency={profile.base_currency} />
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
