"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { computePeriodSummary } from "@strata/finance-core";
import type {
  Account,
  Category,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_TRANSACTION_TYPES,
  getCategoryIcon,
  TRANSACTION_TYPE_META,
} from "@/lib/category-icons";
import { toCoreTransaction } from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface OperationsClientProps {
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  initialTransactions: Transaction[];
  initialTotal: number;
  initialHasMore: boolean;
  initialPeriodYear: number;
  initialPeriodMonth: number;
  initialAccountFilter?: string;
  initialCategoryFilter?: string;
  initialTypeFilter?: TransactionType | "";
  initialStatusFilter?: TransactionStatus | "";
}

const PAGE_LIMIT = 50;

function getMonthBoundsIso(year: number, month: number): { from: string; to: string } {
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
  const to = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return { from, to };
}

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function OperationsClient({
  baseCurrency,
  accounts,
  categories,
  initialTransactions,
  initialTotal,
  initialHasMore,
  initialPeriodYear,
  initialPeriodMonth,
  initialAccountFilter = "",
  initialCategoryFilter = "",
  initialTypeFilter = "",
  initialStatusFilter = "",
}: OperationsClientProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd, registerOnMutated } = useQuickAdd();

  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Filters
  const [allTime, setAllTime] = useState(false);
  const [periodYear, setPeriodYear] = useState(initialPeriodYear);
  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">(initialTypeFilter);
  const [accountFilter, setAccountFilter] = useState(initialAccountFilter);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "">(initialStatusFilter);

  const isFirstMountRef = useRef(true);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchTransactions = useCallback(
    async (opts: { offset?: number; append?: boolean } = {}) => {
      const offset = opts.offset ?? 0;
      const append = opts.append ?? false;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_LIMIT));
        params.set("offset", String(offset));

        if (!allTime) {
          const { from, to } = getMonthBoundsIso(periodYear, periodMonth);
          params.set("from", from);
          params.set("to", to);
        }
        if (typeFilter) params.set("type", typeFilter);
        if (accountFilter) params.set("account_id", accountFilter);
        if (categoryFilter) params.set("category_id", categoryFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/v1/transactions?${params.toString()}`);
        if (!res.ok) {
          toast.error(t.errors.generic);
          return;
        }

        const json = (await res.json()) as {
          transactions: Transaction[];
          total: number;
          has_more: boolean;
        };

        setTransactions((prev) => (append ? [...prev, ...json.transactions] : json.transactions));
        setTotal(json.total);
        setHasMore(json.has_more);
      } catch {
        toast.error(t.errors.generic);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      allTime,
      periodYear,
      periodMonth,
      typeFilter,
      accountFilter,
      categoryFilter,
      statusFilter,
      debouncedSearch,
      t.errors.generic,
    ]
  );

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    void fetchTransactions({ offset: 0, append: false });
  }, [fetchTransactions]);

  useEffect(() => {
    return registerOnMutated(() => {
      void fetchTransactions({ offset: 0, append: false });
    });
  }, [registerOnMutated, fetchTransactions]);

  const periodSummary = useMemo(() => {
    const coreTxs = transactions.map(toCoreTransaction);
    if (allTime) {
      let activeIncomeMinor = 0;
      let passiveIncomeMinor = 0;
      let grossExpenseMinor = 0;
      let compensationMinor = 0;
      for (const tx of coreTxs) {
        if (tx.deletedAt || tx.status !== "confirmed") continue;
        if (tx.type === "income") activeIncomeMinor += tx.amountMinor;
        else if (tx.type === "passive_income") passiveIncomeMinor += tx.amountMinor;
        else if (tx.type === "expense") grossExpenseMinor += tx.amountMinor;
        else if (tx.type === "compensation") compensationMinor += tx.amountMinor;
      }
      const totalIncomeMinor = activeIncomeMinor + passiveIncomeMinor;
      const netExpenseMinor = Math.max(0, grossExpenseMinor - compensationMinor);
      const netBalanceMinor = totalIncomeMinor - netExpenseMinor;
      return { totalIncomeMinor, netExpenseMinor, netBalanceMinor, compensationMinor };
    }
    return computePeriodSummary(coreTxs, periodYear, periodMonth);
  }, [transactions, allTime, periodYear, periodMonth]);

  const groupedByDay = useMemo(() => {
    const groups: Array<{
      dateKey: string;
      label: string;
      dayNetMinor: number;
      items: Transaction[];
    }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();

    const todayKey = getLocalDateKey(new Date().toISOString());
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yest.toISOString());

    const formatter = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "long",
    });

    for (const tx of transactions) {
      const dateKey = getLocalDateKey(tx.occurred_at);
      let group = byKey.get(dateKey);
      if (!group) {
        let label = formatter.format(new Date(`${dateKey}T12:00:00`));
        if (dateKey === todayKey) label = t.transactions.today;
        else if (dateKey === yesterdayKey) label = t.transactions.yesterday;

        group = { dateKey, label, dayNetMinor: 0, items: [] };
        byKey.set(dateKey, group);
        groups.push(group);
      }

      group.items.push(tx);
      if (tx.status === "confirmed") {
        if (tx.type === "income" || tx.type === "passive_income" || tx.type === "compensation") {
          group.dayNetMinor += tx.amount_minor;
        } else if (tx.type === "expense") {
          group.dayNetMinor -= tx.amount_minor;
        }
      }
    }

    return groups;
  }, [transactions, locale, t.transactions.today, t.transactions.yesterday]);

  const periodLabel = useMemo(() => {
    if (allTime) return t.transactions.filters.allTime;
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(periodYear, periodMonth - 1, 1));
  }, [allTime, locale, periodYear, periodMonth, t.transactions.filters.allTime]);

  function shiftMonth(delta: number) {
    setAllTime(false);
    const next = new Date(periodYear, periodMonth - 1 + delta, 1);
    setPeriodYear(next.getFullYear());
    setPeriodMonth(next.getMonth() + 1);
  }

  function resetFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setTypeFilter("");
    setAccountFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setAllTime(false);
    setPeriodYear(initialPeriodYear);
    setPeriodMonth(initialPeriodMonth);
  }

  async function handleConfirmDraft(tx: Transaction) {
    if (!tx.account_from_id || (tx.type === "transfer" && !tx.account_to_id)) {
      openQuickAdd({ transaction: tx });
      return;
    }

    setConfirmingId(tx.id);
    try {
      const res = await fetch(`/api/v1/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      toast.success(t.transactions.confirmedToast);
      void fetchTransactions({ offset: 0, append: false });
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setConfirmingId(null);
    }
  }

  const hasActiveFilters = Boolean(
    debouncedSearch || typeFilter || accountFilter || categoryFilter || statusFilter || allTime
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.transactions.title}
          </h1>
          <p className="text-sm text-[var(--strata-text-muted)]">{t.transactions.subtitle}</p>
        </div>

        <Button type="button" onClick={() => openQuickAdd()}>
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {t.nav.addOperation}
        </Button>
      </div>

      {/* Period & KPI Strip */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.transactions.filters.prevMonth}
              onClick={() => shiftMonth(-1)}
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
              aria-label={t.transactions.filters.nextMonth}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setAllTime((v) => !v)}
            aria-pressed={allTime}
            className={cn(
              "min-h-10 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition",
              allTime
                ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                : "border-[var(--strata-border-subtle)] text-[var(--strata-text-secondary)] hover:border-[var(--strata-border-strong)]"
            )}
          >
            {t.transactions.filters.allTime}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <div className="min-w-0 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
            <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
              {t.dashboard.monthIncome}
            </div>
            <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-money-income)] sm:text-lg">
              <AmountText
                minor={periodSummary.totalIncomeMinor}
                currency={baseCurrency}
                showSign
              />
            </div>
          </div>

          <div className="min-w-0 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
            <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
              {t.dashboard.monthExpense}
            </div>
            <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-money-expense)] sm:text-lg">
              <AmountText
                minor={periodSummary.netExpenseMinor > 0 ? -periodSummary.netExpenseMinor : 0}
                currency={baseCurrency}
              />
            </div>
          </div>

          <div className="col-span-2 min-w-0 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5 sm:col-span-1">
            <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
              {t.dashboard.monthSaldo}
            </div>
            <div className="mt-1 overflow-visible text-base font-bold text-[var(--strata-text-primary)] sm:text-lg">
              <AmountText
                minor={periodSummary.netBalanceMinor}
                currency={baseCurrency}
                showSign
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="space-y-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--strata-text-muted)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.transactions.filters.searchPlaceholder}
              className="pl-10"
            />
          </div>

          <Select
            value={typeFilter || "__all__"}
            onValueChange={(val) =>
              setTypeFilter(val === "__all__" ? "" : (val as TransactionType))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t.transactions.filters.allTypes}</SelectItem>
              {ALL_TRANSACTION_TYPES.map((key) => (
                <SelectItem key={key} value={key}>
                  {t.transactions.types[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={accountFilter || "__all__"}
            onValueChange={(val) => setAccountFilter(val === "__all__" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t.transactions.filters.allAccounts}</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter || "__all__"}
            onValueChange={(val) => setCategoryFilter(val === "__all__" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t.transactions.filters.allCategories}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { value: "", label: t.transactions.filters.statusAll },
                { value: "confirmed", label: t.transactions.filters.statusConfirmed },
                { value: "draft", label: t.transactions.filters.statusDraft },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                aria-pressed={statusFilter === opt.value}
                className={cn(
                  "min-h-9 cursor-pointer rounded-full border px-3 text-xs font-medium transition",
                  statusFilter === opt.value
                    ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                    : "border-[var(--strata-border-subtle)] text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--strata-text-muted)]">
            <span>
              {t.transactions.filters.showingCount
                .replace("{shown}", String(transactions.length))
                .replace("{total}", String(total))}
            </span>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[var(--strata-accent-brand)] hover:underline"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                {t.transactions.filters.resetFilters}
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Date-grouped Ledger */}
      {loading ? (
        <Card className="p-8 text-center text-sm text-[var(--strata-text-muted)]">
          {t.common.loading}
        </Card>
      ) : groupedByDay.length === 0 ? (
        <Card className="space-y-3 py-10 text-center">
          <p className="text-base font-semibold text-[var(--strata-text-primary)]">
            {t.transactions.filters.emptyTitle}
          </p>
          <p className="text-sm text-[var(--strata-text-muted)]">
            {t.transactions.filters.emptyBody}
          </p>
          <div className="pt-2">
            <Button type="button" onClick={() => openQuickAdd()}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t.nav.addOperation}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByDay.map((group) => (
            <Card key={group.dateKey} className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--strata-border-subtle)] pb-2.5">
                <span className="text-xs font-bold capitalize tracking-wide text-[var(--strata-text-secondary)]">
                  {group.label}
                </span>
                {group.dayNetMinor !== 0 ? (
                  <span className="text-xs font-semibold text-[var(--strata-text-muted)]">
                    <AmountText
                      minor={group.dayNetMinor}
                      currency={baseCurrency}
                      showSign
                    />
                  </span>
                ) : null}
              </div>

              <div className="divide-y divide-[var(--strata-border-subtle)]">
                {group.items.map((tx) => {
                  const meta = TRANSACTION_TYPE_META[tx.type];
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : null;
                  const fromAcc = tx.account_from_id ? accountMap.get(tx.account_from_id) : null;
                  const toAcc = tx.account_to_id ? accountMap.get(tx.account_to_id) : null;
                  const Icon = category ? getCategoryIcon(category.icon) : meta.icon;
                  const signedMinor =
                    meta.sign === "-" ? -tx.amount_minor : tx.amount_minor;
                  const displayCurrency = fromAcc?.currency ?? baseCurrency;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <button
                        type="button"
                        onClick={() => openQuickAdd({ transaction: tx })}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left transition hover:opacity-85"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                              {category?.name ?? t.transactions.types[tx.type]}
                            </span>
                            {category ? (
                              <span className="text-[11px] text-[var(--strata-text-muted)]">
                                · {t.transactions.types[tx.type]}
                              </span>
                            ) : null}
                            {tx.status === "draft" ? (
                              <Badge tone="warn">{t.transactions.draftBadge}</Badge>
                            ) : null}
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--strata-text-muted)]">
                            {tx.type === "transfer" ? (
                              <span className="inline-flex items-center gap-1">
                                <span>
                                  {fromAcc?.name ?? t.transactions.filters.unknownAccount}
                                </span>
                                <ArrowRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                                <span>
                                  {toAcc?.name ?? t.transactions.filters.unknownAccount}
                                </span>
                              </span>
                            ) : (
                              <span>
                                {fromAcc?.name ??
                                  (tx.status === "draft"
                                    ? t.transactions.noAccountOption
                                    : t.transactions.filters.unknownAccount)}
                              </span>
                            )}
                            {tx.comment ? (
                              <span className="truncate text-[var(--strata-text-secondary)]">
                                · {tx.comment}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        {tx.status === "draft" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={confirmingId === tx.id}
                            onClick={() => void handleConfirmDraft(tx)}
                            title={t.transactions.confirmDraft}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                            <span className="hidden sm:inline">{t.transactions.confirmDraft}</span>
                          </Button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => openQuickAdd({ transaction: tx })}
                          className="cursor-pointer whitespace-nowrap text-right text-sm font-bold sm:text-base"
                          style={{ color: meta.colorVar }}
                        >
                          <AmountText
                            minor={signedMinor}
                            currency={displayCurrency}
                            showSign={meta.sign === "+"}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() =>
                  void fetchTransactions({ offset: transactions.length, append: true })
                }
              >
                {loadingMore ? t.common.loading : t.transactions.filters.loadMore}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
