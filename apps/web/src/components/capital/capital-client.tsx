"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeAllAccountBalances,
  computeCategoryBreakdown,
  computeCreditCardAvailable,
  computeCreditCardDebt,
} from "@strata/finance-core";
import type { Account, Category, Transaction } from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCOUNT_TYPE_ICONS, getCategoryIcon } from "@/lib/category-icons";
import {
  toCoreAccount,
  toCoreCategory,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { AccountFormDialog } from "./account-form-dialog";
import { CategoryFormDialog } from "./category-form-dialog";

interface CapitalClientProps {
  baseCurrency: string;
  initialTab: "accounts" | "categories";
  initialAccounts: Account[];
  initialCategories: Category[];
  initialTransactions: Transaction[];
  currentYear: number;
  currentMonth: number;
}

export function CapitalClient({
  baseCurrency,
  initialTab,
  initialAccounts,
  initialCategories,
  initialTransactions,
  currentYear,
  currentMonth,
}: CapitalClientProps) {
  const { t } = useI18n();
  const { openQuickAdd, registerOnMutated, setReferenceData } = useQuickAdd();

  const [activeTab, setActiveTab] = useState<"accounts" | "categories">(initialTab);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [showArchived, setShowArchived] = useState(false);

  // Dialog states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountFormSeq, setAccountFormSeq] = useState(0);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deletingAccountBusy, setDeletingAccountBusy] = useState(false);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryFormSeq, setCategoryFormSeq] = useState(0);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultCategoryKind, setDefaultCategoryKind] = useState<"expense" | "income">(
    "expense"
  );
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deletingCategoryBusy, setDeletingCategoryBusy] = useState(false);

  const openAccountForm = (acc: Account | null) => {
    setEditingAccount(acc);
    setAccountFormSeq((n) => n + 1);
    setAccountDialogOpen(true);
  };

  const openCategoryForm = (
    cat: Category | null,
    kind: "expense" | "income" = "expense"
  ) => {
    setEditingCategory(cat);
    setDefaultCategoryKind(kind);
    setCategoryFormSeq((n) => n + 1);
    setCategoryDialogOpen(true);
  };

  const refreshData = useCallback(async () => {
    try {
      const monthFrom = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0).toISOString();
      const [accRes, catRes, txRes] = await Promise.all([
        fetch("/api/v1/accounts"),
        fetch("/api/v1/categories"),
        fetch(`/api/v1/transactions?from=${encodeURIComponent(monthFrom)}&limit=200`),
      ]);

      let nextAccounts: Account[] | undefined;
      let nextCategories: Category[] | undefined;

      if (accRes.ok) {
        const json = (await accRes.json()) as { accounts: Account[] };
        nextAccounts = json.accounts;
        setAccounts(json.accounts);
      }
      if (catRes.ok) {
        const json = (await catRes.json()) as { categories: Category[] };
        nextCategories = json.categories;
        setCategories(json.categories);
      }
      if (txRes.ok) {
        const json = (await txRes.json()) as { transactions: Transaction[] };
        setTransactions(json.transactions);
      }

      if (nextAccounts || nextCategories) {
        setReferenceData({
          ...(nextAccounts ? { accounts: nextAccounts } : {}),
          ...(nextCategories ? { categories: nextCategories } : {}),
        });
      }
    } catch {
      // ignore transient refresh failure
    }
  }, [currentYear, currentMonth, setReferenceData]);

  useEffect(() => {
    return registerOnMutated(() => {
      void refreshData();
    });
  }, [registerOnMutated, refreshData]);

  const coreAccounts = useMemo(() => accounts.map(toCoreAccount), [accounts]);
  const coreCategories = useMemo(() => categories.map(toCoreCategory), [categories]);
  const coreTransactions = useMemo(() => transactions.map(toCoreTransaction), [transactions]);

  const balances = useMemo(
    () => computeAllAccountBalances(coreAccounts, coreTransactions),
    [coreAccounts, coreTransactions]
  );

  const accountSummary = useMemo(() => {
    let liquidMinor = 0;
    let savingsMinor = 0;
    for (const acc of coreAccounts) {
      if (!acc.isActive) continue;
      const bal = balances[acc.id] ?? acc.initialBalanceMinor;
      if (acc.type === "debit" || acc.type === "cash") liquidMinor += bal;
      else if (acc.type === "savings" || acc.type === "deposit") savingsMinor += bal;
    }
    const creditDebtMinor = computeCreditCardDebt(
      coreAccounts.filter((a) => a.isActive),
      balances
    );
    return {
      liquidMinor,
      savingsMinor,
      creditDebtMinor,
      activeCount: accounts.filter((a) => a.is_active).length,
    };
  }, [coreAccounts, balances, accounts]);

  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : accounts.filter((a) => a.is_active)),
    [accounts, showArchived]
  );

  const archivedCount = useMemo(
    () => accounts.filter((a) => !a.is_active).length,
    [accounts]
  );

  const categoryBreakdownMap = useMemo(() => {
    const items = computeCategoryBreakdown(
      coreCategories,
      coreTransactions,
      currentYear,
      currentMonth
    );
    return new Map(items.map((item) => [item.categoryId, item]));
  }, [coreCategories, coreTransactions, currentYear, currentMonth]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income"),
    [categories]
  );

  async function handleToggleArchive(acc: Account) {
    try {
      const res = await fetch(`/api/v1/accounts/${acc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !acc.is_active }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(
        acc.is_active ? t.capital.accountArchivedToast : t.capital.accountRestoredToast
      );
      await refreshData();
    } catch {
      toast.error(t.errors.generic);
    }
  }

  async function handleDeleteAccount() {
    if (!deletingAccount) return;
    setDeletingAccountBusy(true);
    try {
      const res = await fetch(`/api/v1/accounts/${deletingAccount.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.capital.accountDeletedToast);
      setDeletingAccount(null);
      await refreshData();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeletingAccountBusy(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCategory) return;
    setDeletingCategoryBusy(true);
    try {
      const res = await fetch(`/api/v1/categories/${deletingCategory.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.capital.categoryDeletedToast);
      setDeletingCategory(null);
      await refreshData();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeletingCategoryBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.capital.title}
          </h1>
          <p className="text-sm text-[var(--strata-text-muted)]">{t.capital.subtitle}</p>
        </div>

        {activeTab === "accounts" ? (
          <Button type="button" onClick={() => openAccountForm(null)}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t.capital.addAccount}
          </Button>
        ) : (
          <Button type="button" onClick={() => openCategoryForm(null, "expense")}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t.capital.addCategory}
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val === "categories" ? "categories" : "accounts")}
      >
        <TabsList>
          <TabsTrigger value="accounts">{t.capital.accountsTab}</TabsTrigger>
          <TabsTrigger value="categories">{t.capital.categoriesTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-5">
          {/* Accounts KPI strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <Card className="min-w-0 p-3.5 sm:p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.capital.liquidSummary}
              </div>
              <div className="mt-1.5 truncate text-base font-bold text-[var(--strata-text-primary)] sm:text-lg">
                <AmountText minor={accountSummary.liquidMinor} currency={baseCurrency} />
              </div>
            </Card>

            <Card className="min-w-0 p-3.5 sm:p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.capital.savingsSummary}
              </div>
              <div className="mt-1.5 truncate text-base font-bold text-[var(--strata-money-income)] sm:text-lg">
                <AmountText minor={accountSummary.savingsMinor} currency={baseCurrency} />
              </div>
            </Card>

            <Card className="min-w-0 p-3.5 sm:p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.capital.creditDebtSummary}
              </div>
              <div
                className={cn(
                  "mt-1.5 truncate text-base font-bold sm:text-lg",
                  accountSummary.creditDebtMinor > 0
                    ? "text-[var(--strata-money-expense)]"
                    : "text-[var(--strata-text-primary)]"
                )}
              >
                <AmountText minor={accountSummary.creditDebtMinor} currency={baseCurrency} />
              </div>
            </Card>

            <Card className="min-w-0 p-3.5 sm:p-4">
              <div className="truncate text-xs font-medium text-[var(--strata-text-muted)]">
                {t.capital.accountsCount}
              </div>
              <div className="strata-mono mt-1.5 text-base font-bold text-[var(--strata-text-primary)] sm:text-lg">
                {accountSummary.activeCount}
              </div>
            </Card>
          </div>

          {archivedCount > 0 ? (
            <div className="flex items-center justify-end gap-2.5">
              <Label htmlFor="cap-show-archived" className="text-xs text-[var(--strata-text-muted)]">
                {t.capital.showArchived} ({archivedCount})
              </Label>
              <Switch
                id="cap-show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
            </div>
          ) : null}

          {visibleAccounts.length === 0 ? (
            <Card className="space-y-3 py-10 text-center">
              <p className="text-sm text-[var(--strata-text-muted)]">{t.dashboard.noAccounts}</p>
              <div>
                <Button type="button" onClick={() => openAccountForm(null)}>
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  {t.capital.addAccount}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleAccounts.map((acc) => {
                const Icon = ACCOUNT_TYPE_ICONS[acc.type] ?? Wallet;
                const coreAcc = toCoreAccount(acc);
                const balanceMinor = balances[acc.id] ?? acc.initial_balance_minor;
                const creditAvailable =
                  acc.type === "credit" && acc.credit_limit_minor > 0
                    ? computeCreditCardAvailable(coreAcc, balanceMinor)
                    : null;
                const creditUsed =
                  acc.type === "credit" ? Math.max(0, -balanceMinor) : 0;
                const creditUtilRatio =
                  acc.type === "credit" && acc.credit_limit_minor > 0
                    ? Math.min(1, creditUsed / acc.credit_limit_minor)
                    : 0;

                return (
                  <Card
                    key={acc.id}
                    className={cn("space-y-3 p-4 sm:p-5", !acc.is_active && "opacity-65")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/operations?account=${acc.id}`}
                              className="truncate text-base font-bold text-[var(--strata-text-primary)] hover:underline"
                            >
                              {acc.name}
                            </Link>
                            {!acc.is_active ? (
                              <Badge>{t.dashboard.archivedBadge}</Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--strata-text-muted)]">
                            <span>{t.onboarding.accountTypes[acc.type]}</span>
                            {acc.bank_name ? <span>· {acc.bank_name}</span> : null}
                            {acc.last4_digits ? (
                              <span className="strata-mono">··{acc.last4_digits}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 whitespace-nowrap text-right text-base font-extrabold text-[var(--strata-text-primary)] sm:text-lg">
                        <AmountText minor={balanceMinor} currency={acc.currency} />
                      </div>
                    </div>

                    {creditAvailable !== null ? (
                      <div className="space-y-1.5 rounded-2xl bg-[var(--strata-bg-elevated)] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[var(--strata-text-muted)]">
                            {t.capital.creditAvailableLabel}:{" "}
                            <strong className="text-[var(--strata-text-primary)]">
                              <AmountText minor={creditAvailable} currency={acc.currency} />
                            </strong>
                          </span>
                          <span className="text-[var(--strata-text-muted)]">
                            {t.capital.creditLimitLabel}:{" "}
                            <AmountText minor={acc.credit_limit_minor} currency={acc.currency} />
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--strata-bg-surface)]">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.round(creditUtilRatio * 100)}%`,
                              backgroundColor:
                                creditUtilRatio >= 0.85
                                  ? "var(--strata-money-expense)"
                                  : creditUtilRatio >= 0.5
                                    ? "var(--strata-radar-warn)"
                                    : "var(--strata-accent-brand)",
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-start gap-1.5 border-t border-[var(--strata-border-subtle)] pt-3 sm:justify-end">
                      {acc.is_active ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openQuickAdd({ accountFromId: acc.id })}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t.capital.quickOperation}
                        </Button>
                      ) : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openAccountForm(acc)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t.common.edit}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleToggleArchive(acc)}
                      >
                        {acc.is_active ? (
                          <Archive className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <ArchiveRestore
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        )}
                        {acc.is_active ? t.common.archive : t.common.restore}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingAccount(acc)}
                        className="text-[var(--strata-money-expense)] hover:text-[var(--strata-money-expense)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t.common.delete}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-5">
          {/* Expense Categories */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
                {t.onboarding.expenseCategories}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openCategoryForm(null, "expense")}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t.common.add}
              </Button>
            </div>

            {expenseCategories.length === 0 ? (
              <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                {t.capital.noCategories}
              </div>
            ) : (
              <div className="divide-y divide-[var(--strata-border-subtle)]">
                {expenseCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  const stats = categoryBreakdownMap.get(cat.id);
                  const spentMinor = stats?.netSpentMinor ?? 0;
                  const limitMinor = cat.monthly_limit_minor;
                  const ratio =
                    limitMinor && limitMinor > 0 ? Math.min(1, spentMinor / limitMinor) : 0;
                  const isOver = Boolean(limitMinor && limitMinor > 0 && spentMinor > limitMinor);
                  const isWarn = Boolean(
                    limitMinor && limitMinor > 0 && !isOver && spentMinor / limitMinor >= 0.8
                  );

                  return (
                    <div key={cat.id} className="space-y-2.5 py-3 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                              {cat.name}
                            </div>
                            {cat.hint ? (
                              <div className="truncate text-xs text-[var(--strata-text-muted)]">
                                {cat.hint}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t.common.edit}
                            onClick={() => openCategoryForm(cat)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t.common.delete}
                            onClick={() => setDeletingCategory(cat)}
                            className="text-[var(--strata-money-expense)] hover:text-[var(--strata-money-expense)]"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      {limitMinor !== null && limitMinor > 0 ? (
                        <div className="space-y-1.5 rounded-2xl bg-[var(--strata-bg-elevated)] px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-[var(--strata-text-muted)]">
                              {t.capital.spentThisMonth}:{" "}
                              <strong className="text-[var(--strata-text-primary)]">
                                <AmountText minor={spentMinor} currency={baseCurrency} />
                              </strong>{" "}
                              {t.capital.ofLimit}{" "}
                              <AmountText minor={limitMinor} currency={baseCurrency} />
                            </span>
                            {isOver ? (
                              <Badge tone="warn">{t.capital.overLimit}</Badge>
                            ) : null}
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--strata-bg-surface)]">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${Math.round(ratio * 100)}%`,
                                backgroundColor: isOver
                                  ? "var(--strata-money-expense)"
                                  : isWarn
                                    ? "var(--strata-radar-warn)"
                                    : "var(--strata-radar-ok)",
                              }}
                            />
                          </div>
                        </div>
                      ) : spentMinor > 0 ? (
                        <div className="text-xs text-[var(--strata-text-muted)]">
                          {t.capital.spentThisMonth}:{" "}
                          <AmountText minor={spentMinor} currency={baseCurrency} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Income Categories */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]">
                {t.onboarding.incomeCategories}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openCategoryForm(null, "income")}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t.common.add}
              </Button>
            </div>

            {incomeCategories.length === 0 ? (
              <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                {t.capital.noCategories}
              </div>
            ) : (
              <div className="divide-y divide-[var(--strata-border-subtle)]">
                {incomeCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat.icon);
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                              {cat.name}
                            </span>
                            {cat.is_passive ? (
                              <Badge tone="passive">{t.onboarding.passiveBadge}</Badge>
                            ) : null}
                          </div>
                          {cat.hint ? (
                            <div className="truncate text-xs text-[var(--strata-text-muted)]">
                              {cat.hint}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t.common.edit}
                          onClick={() => openCategoryForm(cat)}
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t.common.delete}
                          onClick={() => setDeletingCategory(cat)}
                          className="text-[var(--strata-money-expense)] hover:text-[var(--strata-money-expense)]"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <AccountFormDialog
        open={accountDialogOpen}
        formSeq={accountFormSeq}
        onOpenChange={setAccountDialogOpen}
        baseCurrency={baseCurrency}
        account={editingAccount}
        onSuccess={() => void refreshData()}
      />

      <CategoryFormDialog
        open={categoryDialogOpen}
        formSeq={categoryFormSeq}
        onOpenChange={setCategoryDialogOpen}
        baseCurrency={baseCurrency}
        category={editingCategory}
        defaultKind={defaultCategoryKind}
        onSuccess={() => void refreshData()}
      />

      <ConfirmDialog
        open={Boolean(deletingAccount)}
        onOpenChange={(next) => {
          if (!next) setDeletingAccount(null);
        }}
        title={t.capital.deleteAccountTitle}
        description={t.capital.deleteAccountBody}
        confirmLabel={t.common.delete}
        busy={deletingAccountBusy}
        onConfirm={handleDeleteAccount}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(next) => {
          if (!next) setDeletingCategory(null);
        }}
        title={t.capital.deleteCategoryTitle}
        description={t.capital.deleteCategoryBody}
        confirmLabel={t.common.delete}
        busy={deletingCategoryBusy}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
