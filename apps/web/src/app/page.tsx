"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeAllAccountBalances,
  computeDebtsLedger,
  computeNetWorth,
  computePeriodSummary,
  computeSafeToSpend,
  evaluateAmountExpression,
  getPromoRadarStatus,
  type Account,
  type Debt,
  type SavingsRule,
  type Transaction,
} from "@strata/finance-core";
import ruMessages from "../messages/ru.json";
import enMessages from "../messages/en.json";

const DEMO_ACCOUNTS: Account[] = [
  {
    id: "demo-debit",
    name: "Main Debit",
    type: "debit",
    initialBalanceMinor: 5200000,
    creditLimitMinor: 0,
    isActive: true,
  },
  {
    id: "demo-credit",
    name: "Credit Card",
    type: "credit",
    initialBalanceMinor: 0,
    creditLimitMinor: 8000000,
    isActive: true,
  },
  {
    id: "demo-savings",
    name: "Savings",
    type: "savings",
    initialBalanceMinor: 29445000,
    creditLimitMinor: 0,
    isActive: true,
  },
];

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-1",
    occurredAt: "2026-11-05",
    type: "income",
    amountMinor: 7446800,
    categoryId: "salary",
    accountFromId: "demo-debit",
    accountToId: null,
    goalId: null,
    comment: "Salary",
    status: "confirmed",
  },
  {
    id: "demo-tx-2",
    occurredAt: "2026-11-08",
    type: "passive_income",
    amountMinor: 443200,
    categoryId: "interest",
    accountFromId: "demo-savings",
    accountToId: null,
    goalId: null,
    comment: "Interest",
    status: "confirmed",
  },
  {
    id: "demo-tx-3",
    occurredAt: "2026-11-12",
    type: "expense",
    amountMinor: 360000,
    categoryId: "cafe",
    accountFromId: "demo-credit",
    accountToId: null,
    goalId: null,
    comment: "Dinner",
    status: "confirmed",
  },
  {
    id: "demo-tx-4",
    occurredAt: "2026-11-12",
    type: "compensation",
    amountMinor: 240000,
    categoryId: "cafe",
    accountFromId: "demo-debit",
    accountToId: null,
    goalId: null,
    comment: "Split",
    status: "confirmed",
  },
];

const DEMO_DEBTS: Debt[] = [
  {
    id: "demo-debt-1",
    direction: "lent",
    counterparty: "Alex",
    amountMinor: 450000,
    manualRepaidMinor: 0,
    openedAt: "2026-11-10",
  },
];

const DEMO_SAVINGS_RULE: SavingsRule = {
  id: "demo-sr-1",
  accountId: "demo-savings",
  accrualType: "daily_balance",
  baseRate: 0.1,
  promoRate: 0.16,
  promoEndDate: "2026-12-05",
  capitalization: true,
  minBalanceOverrideMinor: null,
};

function formatRubMinor(minor: number, locale: "ru" | "en"): string {
  const formatter = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 2,
  });
  return `${formatter.format(minor / 100)} ₽`;
}

export default function HomePage() {
  const [locale, setLocale] = useState<"ru" | "en">("ru");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [calcInput, setCalcInput] = useState("=320+185");

  const t = locale === "ru" ? ruMessages : enMessages;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.lang = locale;
  }, [theme, locale]);

  const metrics = useMemo(() => {
    const balances = computeAllAccountBalances(DEMO_ACCOUNTS, DEMO_TRANSACTIONS);
    const debts = computeDebtsLedger(DEMO_DEBTS, DEMO_TRANSACTIONS);
    const netWorth = computeNetWorth(
      DEMO_ACCOUNTS,
      balances,
      debts.totalBorrowedRemainingMinor,
    );
    const safeToSpend = computeSafeToSpend(DEMO_ACCOUNTS, balances, 75000);
    const period = computePeriodSummary(DEMO_TRANSACTIONS, 2026, 11);
    const radar = getPromoRadarStatus(DEMO_SAVINGS_RULE, "2026-11-26", 14);
    return { netWorth, safeToSpend, period, radar };
  }, []);

  const parsedMinor = useMemo(() => evaluateAmountExpression(calcInput), [calcInput]);

  return (
    <main className={privacyBlur ? "privacy-blur min-h-screen" : "min-h-screen"}>
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="Strata" className="h-11 w-11 rounded-2xl shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{t.brand}</h1>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--strata-bg-elevated)",
                    border: "1px solid var(--strata-border-subtle)",
                    color: "var(--strata-accent-neon)",
                  }}
                >
                  {t.stageBadge}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--strata-text-muted)" }}>
                {t.tagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="rounded-full px-3 py-1.5 font-medium"
              style={{
                backgroundColor: "var(--strata-bg-surface)",
                border: "1px solid var(--strata-border-subtle)",
                color: "var(--strata-text-secondary)",
              }}
            >
              🔒 {t.inviteBadge}
            </span>
            <button
              type="button"
              onClick={() => setLocale((prev) => (prev === "ru" ? "en" : "ru"))}
              className="cursor-pointer rounded-full px-3 py-1.5 font-medium"
              style={{
                backgroundColor: "var(--strata-bg-surface)",
                border: "1px solid var(--strata-border-subtle)",
                color: "var(--strata-text-primary)",
              }}
            >
              {locale.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="cursor-pointer rounded-full px-3 py-1.5 font-medium"
              style={{
                backgroundColor: "var(--strata-bg-surface)",
                border: "1px solid var(--strata-border-subtle)",
                color: "var(--strata-text-primary)",
              }}
            >
              {theme === "dark" ? `☀️ ${t.themeLight}` : `🌙 ${t.themeDark}`}
            </button>
            <button
              type="button"
              onClick={() => setPrivacyBlur((prev) => !prev)}
              className="cursor-pointer rounded-full px-3 py-1.5 font-medium"
              style={{
                backgroundColor: privacyBlur
                  ? "var(--strata-border-glow)"
                  : "var(--strata-bg-surface)",
                border: "1px solid var(--strata-border-subtle)",
                color: "var(--strata-text-primary)",
              }}
            >
              {privacyBlur ? "🙈" : "👁️"} {t.privacy}
            </button>
          </div>
        </header>

        {/* Expressive Neobank Hero Card */}
        <section className="strata-hero rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium opacity-80">{t.netWorth}</div>
              <div className="strata-money mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {formatRubMinor(metrics.netWorth, locale)}
              </div>
            </div>
            <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {t.savingsRate}: {(metrics.period.savingsRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-4 text-sm">
            <div>
              <span className="opacity-80">{t.safeToSpend}: </span>
              <span className="strata-money font-bold">
                {formatRubMinor(metrics.safeToSpend, locale)}
              </span>
            </div>
            <span className="text-xs opacity-75">{t.safeToSpendNote}</span>
          </div>
        </section>

        {/* Metrics & Promo Radar */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="strata-glass rounded-2xl p-4">
            <div className="text-xs" style={{ color: "var(--strata-text-muted)" }}>
              {t.income}
            </div>
            <div
              className="strata-money mt-1 text-xl font-bold"
              style={{ color: "var(--strata-money-income)" }}
            >
              +{formatRubMinor(metrics.period.totalIncomeMinor, locale)}
            </div>
            <div
              className="strata-money mt-1 text-xs"
              style={{ color: "var(--strata-text-muted)" }}
            >
              {t.passiveLabel}: {formatRubMinor(metrics.period.passiveIncomeMinor, locale)}
            </div>
          </div>

          <div className="strata-glass rounded-2xl p-4">
            <div className="text-xs" style={{ color: "var(--strata-text-muted)" }}>
              {t.netExpense}
            </div>
            <div
              className="strata-money mt-1 text-xl font-bold"
              style={{ color: "var(--strata-money-expense)" }}
            >
              {formatRubMinor(metrics.period.netExpenseMinor, locale)}
            </div>
            <div
              className="strata-money mt-1 text-xs"
              style={{ color: "var(--strata-money-compensation)" }}
            >
              {t.compensationLabel}: −{formatRubMinor(metrics.period.compensationMinor, locale)}
            </div>
          </div>

          <div className="strata-glass rounded-2xl p-4">
            <div className="text-xs" style={{ color: "var(--strata-text-muted)" }}>
              {t.promoRadar}
            </div>
            <div
              className="mt-1 text-xl font-bold"
              style={{ color: "var(--strata-radar-warn)" }}
            >
              {(metrics.radar.effectiveRate * 100).toFixed(0)}%
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--strata-radar-warn)" }}>
              {t.promoExpiring} {metrics.radar.daysLeft ?? 0} {t.daysShort}
            </div>
          </div>
        </section>

        {/* Live Quick Add Calculator Sandbox */}
        <section className="strata-glass rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="strata-calc" className="text-sm font-semibold">
              {t.calculatorTitle}
            </label>
            <span className="text-xs" style={{ color: "var(--strata-text-muted)" }}>
              {t.engineStatus}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="strata-calc"
              type="text"
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder={t.calculatorPlaceholder}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--strata-bg-surface)",
                border: "1px solid var(--strata-border-strong)",
                color: "var(--strata-text-primary)",
              }}
            />
            <div
              className="strata-money rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{
                backgroundColor: "var(--strata-bg-elevated)",
                border: "1px solid var(--strata-border-subtle)",
                color:
                  parsedMinor !== null
                    ? "var(--strata-accent-neon)"
                    : "var(--strata-money-expense)",
              }}
            >
              {parsedMinor !== null
                ? `${t.calculatorParsed}: ${formatRubMinor(parsedMinor, locale)}`
                : t.calculatorInvalid}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
