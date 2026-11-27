"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlySeriesPoint } from "@strata/finance-core";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type ChartMode = "cashflow" | "netWorth";

interface CashflowTrendChartProps {
  series: MonthlySeriesPoint[];
  year: number;
  baseCurrency: string;
}

interface ChartDatum {
  month: number;
  label: string;
  incomeMinor: number;
  netExpenseMinor: number;
  netBalanceMinor: number;
  netWorthMinor: number | null;
}

const emptySubscribe = () => () => {};

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function formatCompactMinor(minor: number, locale: "ru" | "en", privacyBlur: boolean): string {
  if (privacyBlur) return "•••";
  const major = Math.trunc(minor / 100);
  if (major === 0) return "0";
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(major);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: ChartDatum;
  }>;
  mode: ChartMode;
  baseCurrency: string;
  incomeLabel: string;
  expenseLabel: string;
  saldoLabel: string;
  netWorthLabel: string;
}

function ChartTooltipContent({
  active,
  payload,
  mode,
  baseCurrency,
  incomeLabel,
  expenseLabel,
  saldoLabel,
  netWorthLabel,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="strata-frosted min-w-44 space-y-1.5 rounded-2xl p-3 text-xs shadow-lg">
      <div className="font-bold capitalize text-[var(--strata-text-primary)]">{datum.label}</div>
      {mode === "cashflow" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--strata-text-secondary)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--strata-money-income)" }}
              />
              {incomeLabel}
            </span>
            <AmountText
              minor={datum.incomeMinor}
              currency={baseCurrency}
              className="font-semibold text-[var(--strata-money-income)]"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[var(--strata-text-secondary)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--strata-money-expense)" }}
              />
              {expenseLabel}
            </span>
            <AmountText
              minor={datum.netExpenseMinor > 0 ? -datum.netExpenseMinor : 0}
              currency={baseCurrency}
              className="font-semibold text-[var(--strata-money-expense)]"
            />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--strata-border-subtle)] pt-1">
            <span className="flex items-center gap-1.5 text-[var(--strata-text-secondary)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--strata-accent-brand)" }}
              />
              {saldoLabel}
            </span>
            <AmountText
              minor={datum.netBalanceMinor}
              currency={baseCurrency}
              showSign
              className="font-bold text-[var(--strata-text-primary)]"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--strata-text-secondary)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--strata-accent-brand)" }}
            />
            {netWorthLabel}
          </span>
          {datum.netWorthMinor !== null ? (
            <AmountText
              minor={datum.netWorthMinor}
              currency={baseCurrency}
              className="font-bold text-[var(--strata-text-primary)]"
            />
          ) : (
            <span className="text-[var(--strata-text-muted)]">—</span>
          )}
        </div>
      )}
    </div>
  );
}

export function CashflowTrendChart({
  series,
  year,
  baseCurrency,
}: CashflowTrendChartProps) {
  const { locale, t } = useI18n();
  const { privacyBlur } = usePrivacy();
  const { openQuickAdd } = useQuickAdd();
  const mounted = useIsMounted();
  const gradientId = useId();
  const [mode, setMode] = useState<ChartMode>("cashflow");

  const chartData = useMemo<ChartDatum[]>(() => {
    const formatter = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "short",
    });

    return series.map((pt) => {
      const rawLabel = formatter.format(new Date(year, pt.month - 1, 1));
      const cleanLabel = rawLabel.replace(/\.$/, "");
      return {
        month: pt.month,
        label: cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1),
        incomeMinor: pt.incomeMinor,
        netExpenseMinor: pt.netExpenseMinor,
        netBalanceMinor: pt.netBalanceMinor,
        netWorthMinor: pt.netWorthMinor,
      };
    });
  }, [series, year, locale]);

  const hasData = useMemo(() => {
    if (mode === "netWorth") {
      return chartData.some((d) => d.netWorthMinor !== null);
    }
    return chartData.some((d) => d.incomeMinor > 0 || d.netExpenseMinor > 0);
  }, [chartData, mode]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.dashboard.analytics.trendTitle}
          </h2>
          <p className="text-xs text-[var(--strata-text-muted)]">
            {mode === "cashflow"
              ? t.dashboard.analytics.trendCashflowSubtitle.replace("{year}", String(year))
              : t.dashboard.analytics.trendNetWorthSubtitle.replace("{year}", String(year))}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={t.dashboard.analytics.trendTitle}
          className="inline-flex rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "cashflow"}
            onClick={() => setMode("cashflow")}
            className={cn(
              "min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
              mode === "cashflow"
                ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-sm"
                : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
            )}
          >
            {t.dashboard.analytics.modeCashflow}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "netWorth"}
            onClick={() => setMode("netWorth")}
            className={cn(
              "min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition",
              mode === "netWorth"
                ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-sm"
                : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
            )}
          >
            {t.dashboard.analytics.modeNetWorth}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] p-5 text-sm text-[var(--strata-text-muted)]">
          <span>{t.dashboard.analytics.noChartData}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => openQuickAdd()}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {t.nav.quickAdd}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === "cashflow" ? (
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--strata-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--strata-money-income)" }}
                />
                {t.dashboard.monthIncome}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--strata-money-expense)" }}
                />
                {t.dashboard.monthExpense}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-0.5 w-3.5 rounded-full"
                  style={{ backgroundColor: "var(--strata-accent-brand)" }}
                />
                {t.dashboard.monthSaldo}
              </span>
            </div>
          ) : null}

          <div className="h-60 w-full min-w-0 sm:h-64">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                {mode === "cashflow" ? (
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      stroke="var(--strata-border-subtle)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--strata-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fill: "var(--strata-text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => formatCompactMinor(Number(v), locale, privacyBlur)}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--strata-bg-elevated)", opacity: 0.6 }}
                      content={(props) => (
                        <ChartTooltipContent
                          active={props.active}
                          payload={props.payload as CustomTooltipProps["payload"]}
                          mode="cashflow"
                          baseCurrency={baseCurrency}
                          incomeLabel={t.dashboard.monthIncome}
                          expenseLabel={t.dashboard.monthExpense}
                          saldoLabel={t.dashboard.monthSaldo}
                          netWorthLabel={t.dashboard.netWorth}
                        />
                      )}
                    />
                    <ReferenceLine y={0} stroke="var(--strata-border-strong)" strokeDasharray="3 3" />
                    <Bar
                      dataKey="incomeMinor"
                      fill="var(--strata-money-income)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={20}
                    />
                    <Bar
                      dataKey="netExpenseMinor"
                      fill="var(--strata-money-expense)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={20}
                    />
                    <Line
                      type="monotone"
                      dataKey="netBalanceMinor"
                      stroke="var(--strata-accent-brand)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "var(--strata-accent-brand)", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "var(--strata-accent-brand)", strokeWidth: 0 }}
                    />
                  </ComposedChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--strata-accent-brand)" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="var(--strata-accent-brand)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--strata-border-subtle)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--strata-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={56}
                      tick={{ fill: "var(--strata-text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => formatCompactMinor(Number(v), locale, privacyBlur)}
                    />
                    <Tooltip
                      content={(props) => (
                        <ChartTooltipContent
                          active={props.active}
                          payload={props.payload as CustomTooltipProps["payload"]}
                          mode="netWorth"
                          baseCurrency={baseCurrency}
                          incomeLabel={t.dashboard.monthIncome}
                          expenseLabel={t.dashboard.monthExpense}
                          saldoLabel={t.dashboard.monthSaldo}
                          netWorthLabel={t.dashboard.netWorth}
                        />
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="netWorthMinor"
                      connectNulls
                      stroke="var(--strata-accent-brand)"
                      strokeWidth={2.5}
                      fill={`url(#${gradientId})`}
                      dot={{ r: 3, fill: "var(--strata-accent-brand)", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "var(--strata-accent-brand)", strokeWidth: 0 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="strata-skeleton h-full w-full rounded-2xl bg-[var(--strata-bg-elevated)]" />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
