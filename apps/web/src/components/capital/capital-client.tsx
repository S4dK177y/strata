"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
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
  getPromoRadarStatus,
} from "@strata/finance-core";
import type { Account, Category, SavingsRule, Transaction } from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, ModalDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCOUNT_TYPE_ICONS,
  CATEGORY_ICON_LIST,
  getCategoryIcon,
  inferCategoryIconKey,
} from "@/lib/category-icons";
import {
  toCoreAccount,
  toCoreCategory,
  toCoreSavingsRule,
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
  initialSavingsRules?: SavingsRule[];
  promoWarningDays?: number;
  asOfDate?: string;
  currentYear: number;
  currentMonth: number;
}

interface CategoryActionsMenuProps {
  category: Category;
  actionsLabel: string;
  editLabel: string;
  changeIconLabel: string;
  deleteLabel: string;
  onEdit: (cat: Category) => void;
  onChangeIcon: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}

function CategoryActionsMenu({
  category,
  actionsLabel,
  editLabel,
  changeIconLabel,
  deleteLabel,
  onEdit,
  onChangeIcon,
  onDelete,
}: CategoryActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={actionsLabel}
          className="h-9 w-9 shrink-0 rounded-xl"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(category)}>
          <Pencil className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]" strokeWidth={1.75} aria-hidden="true" />
          <span>{editLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChangeIcon(category)}>
          <Wallet className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]" strokeWidth={1.75} aria-hidden="true" />
          <span>{changeIconLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(category)}
          className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>{deleteLabel}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CapitalClient({
  baseCurrency,
  initialTab,
  initialAccounts,
  initialCategories,
  initialTransactions,
  initialSavingsRules = [],
  promoWarningDays = 14,
  asOfDate,
  currentYear,
  currentMonth,
}: CapitalClientProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd, registerOnMutated, setReferenceData } = useQuickAdd();

  const [activeTab, setActiveTab] = useState<"accounts" | "categories">(initialTab);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [savingsRules, setSavingsRules] = useState<SavingsRule[]>(initialSavingsRules);
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
  const [iconPickerCategory, setIconPickerCategory] = useState<Category | null>(null);
  const [savingIcon, setSavingIcon] = useState(false);

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
      const [accRes, catRes, txRes, rulesRes] = await Promise.all([
        fetch("/api/v1/accounts"),
        fetch("/api/v1/categories"),
        fetch(`/api/v1/transactions?from=${encodeURIComponent(monthFrom)}&limit=200`),
        fetch("/api/v1/savings-rules"),
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
      if (rulesRes.ok) {
        const json = (await rulesRes.json()) as { savings_rules: SavingsRule[] };
        setSavingsRules(json.savings_rules);
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

  const effectiveAsOfDate =
    asOfDate ??
    `${currentYear}-${String(currentMonth).padStart(2, "0")}-15`;

  const rateBadgeByAccountId = useMemo(() => {
    const map = new Map<
      string,
      { label: string; tone: "default" | "ok" | "warn" | "danger" }
    >();
    for (const rule of savingsRules) {
      if (rule.deleted_at) continue;
      const radar = getPromoRadarStatus(
        toCoreSavingsRule(rule),
        effectiveAsOfDate,
        promoWarningDays
      );
      const pct = Math.round(radar.effectiveRate * 1000) / 10;
      const label = `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
        maximumFractionDigits: 2,
      }).format(pct)}%`;
      const tone =
        radar.status === "active"
          ? "ok"
          : radar.status === "expiring_soon"
            ? "warn"
            : radar.status === "expired"
              ? "danger"
              : "default";
      map.set(rule.account_id, { label, tone });
    }
    return map;
  }, [savingsRules, effectiveAsOfDate, promoWarningDays, locale]);

  const accountSummary = useMemo(() => {
    let liquidMinor = 0;
    let savingsMinor = 0;
    let creditAvailableMinor = 0;
    let hasCreditCards = false;

    for (const acc of coreAccounts) {
      if (!acc.isActive) continue;
      const bal = balances[acc.id] ?? acc.initialBalanceMinor;
      if (acc.type === "debit" || acc.type === "cash") {
        liquidMinor += bal;
      } else if (acc.type === "savings" || acc.type === "deposit") {
        savingsMinor += bal;
      } else if (acc.type === "credit") {
        hasCreditCards = true;
        creditAvailableMinor += computeCreditCardAvailable(acc, bal);
      }
    }

    const creditDebtMinor = computeCreditCardDebt(
      coreAccounts.filter((a) => a.isActive),
      balances
    );
    const netAccountsMinor = liquidMinor + savingsMinor - creditDebtMinor;

    const liquidPos = Math.max(0, liquidMinor);
    const savingsPos = Math.max(0, savingsMinor);
    const allocTotal = liquidPos + savingsPos + creditDebtMinor;

    return {
      liquidMinor,
      savingsMinor,
      creditDebtMinor,
      creditAvailableMinor,
      hasCreditCards,
      netAccountsMinor,
      liquidShare: allocTotal > 0 ? Math.round((liquidPos / allocTotal) * 100) : 0,
      savingsShare: allocTotal > 0 ? Math.round((savingsPos / allocTotal) * 100) : 0,
      debtShare: allocTotal > 0 ? Math.round((creditDebtMinor / allocTotal) * 100) : 0,
      activeCount: accounts.filter((a) => a.is_active).length,
    };
  }, [coreAccounts, balances, accounts]);

  const visibleAccounts = useMemo(
    () => (showArchived ? accounts : accounts.filter((a) => a.is_active)),
    [accounts, showArchived]
  );

  const groupedAccounts = useMemo(() => {
    const daily = visibleAccounts.filter((a) => a.type === "debit" || a.type === "cash");
    const savings = visibleAccounts.filter((a) => a.type === "savings" || a.type === "deposit");
    const credit = visibleAccounts.filter((a) => a.type === "credit");
    const other = visibleAccounts.filter(
      (a) =>
        a.type !== "debit" &&
        a.type !== "cash" &&
        a.type !== "savings" &&
        a.type !== "deposit" &&
        a.type !== "credit"
    );

    const dailyGroup = [...daily, ...other];

    return [
      { key: "daily", title: t.capital.groupDaily, items: dailyGroup },
      { key: "savings", title: t.capital.groupSavings, items: savings },
      { key: "credit", title: t.capital.groupCredit, items: credit },
    ].filter((g) => g.items.length > 0);
  }, [visibleAccounts, t.capital.groupDaily, t.capital.groupSavings, t.capital.groupCredit]);

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

  const budgetSummary = useMemo(() => {
    let totalLimitMinor = 0;
    let totalSpentMinor = 0;
    for (const cat of expenseCategories) {
      if (cat.monthly_limit_minor !== null && cat.monthly_limit_minor > 0) {
        totalLimitMinor += cat.monthly_limit_minor;
        const stats = categoryBreakdownMap.get(cat.id);
        totalSpentMinor += stats?.netSpentMinor ?? 0;
      }
    }
    const rawPct =
      totalLimitMinor > 0 ? Math.round((totalSpentMinor / totalLimitMinor) * 100) : 0;
    return {
      totalLimitMinor,
      totalSpentMinor,
      rawPct,
      barPct: Math.min(100, Math.max(0, rawPct)),
      isOver: totalLimitMinor > 0 && totalSpentMinor > totalLimitMinor,
      isWarn:
        totalLimitMinor > 0 &&
        totalSpentMinor <= totalLimitMinor &&
        rawPct >= 80,
    };
  }, [expenseCategories, categoryBreakdownMap]);

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

  async function handleQuickIconChange(cat: Category, nextIconKey: string) {
    setSavingIcon(true);
    try {
      const res = await fetch(`/api/v1/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: nextIconKey }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.capital.iconUpdatedToast);
      setIconPickerCategory(null);
      await refreshData();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSavingIcon(false);
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
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.capital.title}
          </h1>

          {activeTab === "accounts" ? (
            <Button type="button" onClick={() => openAccountForm(null)} className="shrink-0">
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.capital.addAccount}</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => openCategoryForm(null, "expense")}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.capital.addCategory}</span>
            </Button>
          )}
        </div>
        <p className="text-sm text-[var(--strata-text-muted)]">{t.capital.subtitle}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val === "categories" ? "categories" : "accounts")}
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto sm:min-w-[290px]">
          <TabsTrigger value="accounts">
            {t.capital.accountsTab} ({accountSummary.activeCount})
          </TabsTrigger>
          <TabsTrigger value="categories">
            {t.capital.categoriesTab} ({categories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-5">
          {/* Unified Portfolio Allocation Card (2A) */}
          <Card className="space-y-3.5 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[var(--strata-text-muted)]">
                  {t.capital.portfolioTotal}
                </div>
                <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--strata-text-primary)] sm:text-[26px]">
                  <AmountText minor={accountSummary.netAccountsMinor} currency={baseCurrency} />
                </div>
              </div>

              {accountSummary.hasCreditCards ? (
                <div className="text-xs text-[var(--strata-text-muted)]">
                  {t.capital.availableCreditShort}:{" "}
                  <strong className="font-bold text-[var(--strata-text-primary)]">
                    <AmountText
                      minor={accountSummary.creditAvailableMinor}
                      currency={baseCurrency}
                    />
                  </strong>
                </div>
              ) : null}
            </div>

            <div
              aria-hidden="true"
              className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]"
            >
              {accountSummary.liquidShare > 0 ? (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${accountSummary.liquidShare}%`,
                    backgroundColor: "var(--strata-money-compensation)",
                  }}
                />
              ) : null}
              {accountSummary.savingsShare > 0 ? (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${accountSummary.savingsShare}%`,
                    backgroundColor: "var(--strata-money-income)",
                  }}
                />
              ) : null}
              {accountSummary.debtShare > 0 ? (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${accountSummary.debtShare}%`,
                    backgroundColor: "var(--strata-money-expense)",
                  }}
                />
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--strata-money-compensation)" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t.capital.liquidShort}</span>
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
                  <AmountText minor={accountSummary.liquidMinor} currency={baseCurrency} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--strata-money-income)" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t.capital.savingsShort}</span>
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-money-income)] sm:text-sm">
                  <AmountText minor={accountSummary.savingsMinor} currency={baseCurrency} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--strata-money-expense)" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t.capital.debtShort}</span>
                </div>
                <div
                  className={cn(
                    "mt-0.5 truncate text-xs font-bold sm:text-sm",
                    accountSummary.creditDebtMinor > 0
                      ? "text-[var(--strata-money-expense)]"
                      : "text-[var(--strata-text-primary)]"
                  )}
                >
                  <AmountText minor={accountSummary.creditDebtMinor} currency={baseCurrency} />
                </div>
              </div>
            </div>
          </Card>

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
            <div className="space-y-5">
              {groupedAccounts.map((group) => (
                <section key={group.key} className="space-y-2.5">
                  <h2 className="px-1 text-xs font-semibold tracking-wider text-[var(--strata-text-muted)] uppercase">
                    {group.title}
                  </h2>

                  <div
                    className={cn(
                      "grid grid-cols-1 gap-3",
                      group.items.length > 1 && "md:grid-cols-2"
                    )}
                  >
                    {group.items.map((acc) => {
                      const Icon = ACCOUNT_TYPE_ICONS[acc.type] ?? Wallet;
                      const coreAcc = toCoreAccount(acc);
                      const balanceMinor = balances[acc.id] ?? acc.initial_balance_minor;
                      const creditAvailable =
                        acc.type === "credit" && acc.credit_limit_minor > 0
                          ? computeCreditCardAvailable(coreAcc, balanceMinor)
                          : null;
                      const creditAvailableRatio =
                        creditAvailable !== null && acc.credit_limit_minor > 0
                          ? Math.max(0, Math.min(1, creditAvailable / acc.credit_limit_minor))
                          : 0;
                      const isCreditDebt = acc.type === "credit" && balanceMinor < 0;

                      return (
                        <Card
                          key={acc.id}
                          className={cn("space-y-3 p-4", !acc.is_active && "opacity-65")}
                        >
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`/operations?account=${acc.id}`}
                                    className="truncate text-sm font-bold text-[var(--strata-text-primary)] hover:underline sm:text-[15px]"
                                  >
                                    {acc.name}
                                  </Link>
                                  {!acc.is_active ? (
                                    <Badge>{t.dashboard.archivedBadge}</Badge>
                                  ) : null}
                                  {rateBadgeByAccountId.has(acc.id) ? (
                                    <Link
                                      href="/plans?tab=savings"
                                      title={t.capital.savingsRateBadgeHint}
                                      className="inline-flex"
                                    >
                                      <Badge
                                        tone={rateBadgeByAccountId.get(acc.id)!.tone}
                                        className="strata-mono"
                                      >
                                        {rateBadgeByAccountId.get(acc.id)!.label}
                                      </Badge>
                                    </Link>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--strata-text-muted)]">
                                  <span className="truncate">
                                    {acc.bank_name || t.onboarding.accountTypes[acc.type]}
                                  </span>
                                  {acc.last4_digits ? (
                                    <span className="strata-mono">· ··{acc.last4_digits}</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <div
                                className={cn(
                                  "whitespace-nowrap text-right text-sm font-extrabold sm:text-base",
                                  isCreditDebt
                                    ? "text-[var(--strata-money-expense)]"
                                    : "text-[var(--strata-text-primary)]"
                                )}
                              >
                                <AmountText minor={balanceMinor} currency={acc.currency} />
                              </div>

                              {acc.is_active ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  aria-label={t.capital.quickOperation}
                                  title={t.capital.quickOperation}
                                  onClick={() => openQuickAdd({ accountFromId: acc.id })}
                                  className="hidden h-9 w-9 rounded-xl sm:inline-flex"
                                >
                                  <Plus className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
                                </Button>
                              ) : null}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t.capital.actionsLabel}
                                    className="h-9 w-9 rounded-xl"
                                  >
                                    <MoreHorizontal
                                      className="h-4 w-4"
                                      strokeWidth={1.75}
                                      aria-hidden="true"
                                    />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {acc.is_active ? (
                                    <DropdownMenuItem
                                      onSelect={() => openQuickAdd({ accountFromId: acc.id })}
                                      className="sm:hidden"
                                    >
                                      <Plus
                                        className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                      <span>{t.capital.quickOperation}</span>
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem onSelect={() => openAccountForm(acc)}>
                                    <Pencil
                                      className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                      strokeWidth={1.75}
                                      aria-hidden="true"
                                    />
                                    <span>{t.common.edit}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => void handleToggleArchive(acc)}>
                                    {acc.is_active ? (
                                      <Archive
                                        className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <ArchiveRestore
                                        className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>
                                      {acc.is_active ? t.common.archive : t.common.restore}
                                    </span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setDeletingAccount(acc)}
                                    className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                    <span>{t.common.delete}</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                                  <AmountText
                                    minor={acc.credit_limit_minor}
                                    currency={acc.currency}
                                  />
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--strata-bg-surface)]">
                                <div
                                  className="h-full rounded-full transition-all duration-500 ease-out"
                                  style={{
                                    width: `${Math.round(creditAvailableRatio * 100)}%`,
                                    backgroundColor: "var(--strata-accent-brand)",
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-5">
          {/* Monthly Budget Summary Card */}
          {budgetSummary.totalLimitMinor > 0 ? (
            <Card className="space-y-2.5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-[var(--strata-text-muted)]">
                    {t.capital.monthlyBudgetTitle}
                  </div>
                  <div className="mt-0.5 text-lg font-extrabold text-[var(--strata-text-primary)] sm:text-xl">
                    <AmountText minor={budgetSummary.totalSpentMinor} currency={baseCurrency} />{" "}
                    <span className="text-xs font-medium text-[var(--strata-text-muted)]">
                      {t.capital.ofLimit}{" "}
                      <AmountText minor={budgetSummary.totalLimitMinor} currency={baseCurrency} />
                    </span>
                  </div>
                </div>
                <Badge tone={budgetSummary.isOver || budgetSummary.isWarn ? "warn" : "neon"}>
                  {t.capital.ofLimitsBadge.replace("{pct}", String(budgetSummary.rawPct))}
                </Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--strata-bg-elevated)]">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${budgetSummary.barPct}%`,
                    backgroundColor: budgetSummary.isOver
                      ? "var(--strata-money-expense)"
                      : budgetSummary.isWarn
                        ? "var(--strata-radar-warn)"
                        : "var(--strata-accent-brand)",
                  }}
                />
              </div>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            {/* Expense Categories */}
            <Card className="space-y-3.5 p-4 sm:p-5">
              <h2 className="text-base font-bold tracking-tight text-[var(--strata-text-primary)] sm:text-lg">
                {t.onboarding.expenseCategories}
              </h2>

              {expenseCategories.length === 0 ? (
                <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                  {t.capital.noCategories}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {expenseCategories.map((cat) => {
                    const Icon = getCategoryIcon(cat.icon, cat.name);
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
                      <div
                        key={cat.id}
                        className="space-y-2.5 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setIconPickerCategory(cat)}
                              aria-label={`${t.capital.changeIcon}: ${cat.name}`}
                              title={t.capital.changeIcon}
                              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[13px] border border-transparent bg-[var(--strata-bg-surface)] text-[var(--strata-text-secondary)] transition hover:border-[var(--strata-accent-brand)] hover:text-[var(--strata-text-primary)]"
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                                  {cat.name}
                                </span>
                                {isOver ? (
                                  <Badge tone="warn">{t.capital.overLimit}</Badge>
                                ) : null}
                              </div>
                              {cat.hint ? (
                                <div className="truncate text-xs text-[var(--strata-text-muted)]">
                                  {cat.hint}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="text-right">
                              <div
                                className={cn(
                                  "text-xs font-bold sm:text-sm",
                                  isOver
                                    ? "text-[var(--strata-money-expense)]"
                                    : "text-[var(--strata-text-primary)]"
                                )}
                              >
                                <AmountText minor={spentMinor} currency={baseCurrency} />
                              </div>
                              <div className="text-[11px] text-[var(--strata-text-muted)]">
                                {limitMinor !== null && limitMinor > 0 ? (
                                  <>
                                    {t.capital.ofLimit}{" "}
                                    <AmountText minor={limitMinor} currency={baseCurrency} />
                                  </>
                                ) : (
                                  t.capital.noLimitLabel
                                )}
                              </div>
                            </div>

                            <CategoryActionsMenu
                              category={cat}
                              actionsLabel={t.capital.actionsLabel}
                              editLabel={t.common.edit}
                              changeIconLabel={t.capital.changeIcon}
                              deleteLabel={t.common.delete}
                              onEdit={(c) => openCategoryForm(c)}
                              onChangeIcon={(c) => setIconPickerCategory(c)}
                              onDelete={setDeletingCategory}
                            />
                          </div>
                        </div>

                        {limitMinor !== null && limitMinor > 0 ? (
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
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Income Categories */}
            <Card className="space-y-3.5 p-4 sm:p-5">
              <h2 className="text-base font-bold tracking-tight text-[var(--strata-text-primary)] sm:text-lg">
                {t.onboarding.incomeCategories}
              </h2>

              {incomeCategories.length === 0 ? (
                <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
                  {t.capital.noCategories}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {incomeCategories.map((cat) => {
                    const Icon = getCategoryIcon(cat.icon, cat.name);
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-2.5 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIconPickerCategory(cat)}
                            aria-label={`${t.capital.changeIcon}: ${cat.name}`}
                            title={t.capital.changeIcon}
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[13px] border border-transparent bg-[var(--strata-bg-surface)] text-[var(--strata-money-income)] transition hover:border-[var(--strata-accent-brand)]"
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
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

                        <CategoryActionsMenu
                          category={cat}
                          actionsLabel={t.capital.actionsLabel}
                          editLabel={t.common.edit}
                          changeIconLabel={t.capital.changeIcon}
                          deleteLabel={t.common.delete}
                          onEdit={(c) => openCategoryForm(c)}
                          onChangeIcon={(c) => setIconPickerCategory(c)}
                          onDelete={setDeletingCategory}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
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

      <ModalDialog
        open={Boolean(iconPickerCategory)}
        onOpenChange={(next) => {
          if (!next && !savingIcon) setIconPickerCategory(null);
        }}
        title={
          iconPickerCategory
            ? `${t.capital.iconPickerTitle}: ${iconPickerCategory.name}`
            : t.capital.iconPickerTitle
        }
        dismissible={!savingIcon}
      >
        {iconPickerCategory ? (
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {CATEGORY_ICON_LIST.map(({ key, icon: Icon }) => {
              const currentIconKey =
                iconPickerCategory.icon ?? inferCategoryIconKey(iconPickerCategory.name) ?? "tag";
              const active = currentIconKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={savingIcon}
                  onClick={() => void handleQuickIconChange(iconPickerCategory, key)}
                  aria-label={key}
                  aria-pressed={active}
                  className={cn(
                    "flex h-11 cursor-pointer items-center justify-center rounded-2xl border transition disabled:opacity-60",
                    active
                      ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                      : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-muted)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}
