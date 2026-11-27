"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Category } from "@strata/api-contract";
import type { CategoryBreakdownItem } from "@strata/finance-core";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const SLICE_COLORS = [
  "var(--strata-accent-brand)",
  "var(--strata-accent-secondary)",
  "var(--strata-goal-envelope)",
  "var(--strata-debt-lent)",
  "var(--strata-radar-warn)",
  "var(--strata-money-expense)",
  "var(--strata-text-muted)",
] as const;

const emptySubscribe = () => () => {};

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface CategoryBreakdownCardProps {
  items: CategoryBreakdownItem[];
  categories: Category[];
  baseCurrency: string;
  periodLabel: string;
}

interface DonutSlice {
  name: string;
  value: number;
  share: number;
  color: string;
}

function DonutTooltip({
  active,
  payload,
  baseCurrency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DonutSlice }>;
  baseCurrency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;

  return (
    <div className="strata-frosted space-y-1 rounded-2xl p-3 text-xs shadow-lg">
      <div className="flex items-center gap-1.5 font-bold text-[var(--strata-text-primary)]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
        <span>{slice.name}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <AmountText
          minor={slice.value}
          currency={baseCurrency}
          className="font-bold text-[var(--strata-text-primary)]"
        />
        <span className="strata-mono text-[var(--strata-text-muted)]">
          {Math.round(slice.share * 100)}%
        </span>
      </div>
    </div>
  );
}

export function CategoryBreakdownCard({
  items,
  categories,
  baseCurrency,
  periodLabel,
}: CategoryBreakdownCardProps) {
  const { t } = useI18n();
  const mounted = useIsMounted();

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const ranked = useMemo(
    () =>
      items
        .filter((item) => item.netSpentMinor > 0)
        .sort((a, b) => b.netSpentMinor - a.netSpentMinor),
    [items]
  );

  const totalSpentMinor = useMemo(
    () => ranked.reduce((acc, item) => acc + item.netSpentMinor, 0),
    [ranked]
  );

  const donutSlices = useMemo<DonutSlice[]>(() => {
    const top = ranked.slice(0, 6);
    const rest = ranked.slice(6);
    const slices: DonutSlice[] = top.map((item, idx) => ({
      name: item.categoryName,
      value: item.netSpentMinor,
      share: item.share,
      color: SLICE_COLORS[idx % SLICE_COLORS.length] ?? "var(--strata-accent-brand)",
    }));

    if (rest.length > 0) {
      const restMinor = rest.reduce((acc, item) => acc + item.netSpentMinor, 0);
      const restShare = rest.reduce((acc, item) => acc + item.share, 0);
      slices.push({
        name: t.dashboard.analytics.otherCategories,
        value: restMinor,
        share: restShare,
        color: SLICE_COLORS[6],
      });
    }
    return slices;
  }, [ranked, t.dashboard.analytics.otherCategories]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.dashboard.analytics.categoriesTitle}
          </h2>
          <p className="truncate text-xs text-[var(--strata-text-muted)]">
            {periodLabel}
          </p>
        </div>

        <Link
          href="/capital?tab=categories"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--strata-accent-brand)] hover:underline"
        >
          {t.dashboard.analytics.manageBudgets}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-5 text-sm text-[var(--strata-text-muted)]">
          {t.dashboard.analytics.noCategorySpend}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
          {/* Donut Chart */}
          <div className="relative mx-auto h-56 w-56 shrink-0 md:h-64 md:w-64 lg:h-72 lg:w-72">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutSlices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="64%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donutSlices.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <DonutTooltip
                        active={props.active}
                        payload={props.payload as ReadonlyArray<{ payload?: DonutSlice }>}
                        baseCurrency={baseCurrency}
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="strata-skeleton h-full w-full rounded-full bg-[var(--strata-bg-elevated)]" />
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <span className="text-[11px] font-medium text-[var(--strata-text-muted)] lg:text-xs">
                {t.dashboard.analytics.totalSpent}
              </span>
              <AmountText
                minor={totalSpentMinor}
                currency={baseCurrency}
                className="text-sm font-extrabold text-[var(--strata-text-primary)] lg:text-lg"
              />
            </div>
          </div>

          {/* Ranked Category List */}
          <div className="min-w-0 divide-y divide-[var(--strata-border-subtle)] md:pl-2 lg:ml-auto lg:w-full lg:max-w-[500px] lg:pl-4">
            {ranked.map((item, idx) => {
              const cat = categoryMap.get(item.categoryId);
              const Icon = getCategoryIcon(cat?.icon ?? null, item.categoryName);
              const dotColor =
                idx < 6 ? SLICE_COLORS[idx] : SLICE_COLORS[6];
              const pct = Math.round(item.share * 100);
              const limitRatio =
                item.periodLimitMinor && item.periodLimitMinor > 0
                  ? Math.min(100, Math.round((item.netSpentMinor / item.periodLimitMinor) * 100))
                  : null;

              return (
                <Link
                  key={item.categoryId}
                  href={`/operations?category=${item.categoryId}`}
                  className="block space-y-2 py-2.5 transition first:pt-0 last:pb-0 hover:opacity-85"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </div>
                      <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                        {item.categoryName}
                      </span>
                      {item.isOverLimit ? (
                        <Badge tone="warn">{t.capital.overLimit}</Badge>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-baseline gap-2 text-right">
                      <AmountText
                        minor={item.netSpentMinor}
                        currency={baseCurrency}
                        className="text-sm font-bold text-[var(--strata-text-primary)]"
                      />
                      <span className="strata-mono w-9 text-right text-xs text-[var(--strata-text-muted)]">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {limitRatio !== null && item.periodLimitMinor !== null ? (
                    <div className="space-y-1 pl-5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            item.isOverLimit
                              ? "bg-[var(--strata-money-expense)]"
                              : "bg-[var(--strata-accent-brand)]"
                          )}
                          style={{ width: `${limitRatio}%` }}
                        />
                      </div>
                      <div className="flex justify-end text-[11px] text-[var(--strata-text-muted)]">
                        {t.capital.ofLimit}{" "}
                        <AmountText
                          minor={item.periodLimitMinor}
                          currency={baseCurrency}
                          className="ml-1"
                        />
                      </div>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
