"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  computeAllAccountBalances,
  computeSavingsPortfolioSummary,
  evaluateRecurringPayments,
} from "@strata/finance-core";
import type {
  Account,
  Category,
  RecurringPayment,
  RecurringPaymentMark,
  SavingsRule,
  Transaction,
} from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  toCoreAccount,
  toCoreRecurringPayment,
  toCoreRecurringPaymentMark,
  toCoreSavingsRule,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { RecurringPaymentFormDialog } from "./recurring-payment-form-dialog";
import { RecurringPaymentsSection } from "./recurring-payments-section";
import { SavingsRadarSection } from "./savings-radar-section";
import { SavingsRuleFormDialog } from "./savings-rule-form-dialog";

interface PlansClientProps {
  baseCurrency: string;
  initialTab: "savings" | "recurring";
  initialAccounts: Account[];
  initialCategories: Category[];
  initialSavingsRules: SavingsRule[];
  initialRecurringPayments: RecurringPayment[];
  initialMarks: RecurringPaymentMark[];
  initialTransactions: Transaction[];
  initialPromoWarningDays: number;
  currentYear: number;
  currentMonth: number;
  asOfDate: string;
}

export function PlansClient({
  baseCurrency,
  initialTab,
  initialAccounts,
  initialCategories,
  initialSavingsRules,
  initialRecurringPayments,
  initialMarks,
  initialTransactions,
  initialPromoWarningDays,
  currentYear,
  currentMonth,
  asOfDate,
}: PlansClientProps) {
  const { t } = useI18n();
  const { registerOnMutated, setReferenceData } = useQuickAdd();

  const [activeTab, setActiveTab] = useState<"savings" | "recurring">(initialTab);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [savingsRules, setSavingsRules] = useState<SavingsRule[]>(initialSavingsRules);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(
    initialRecurringPayments
  );
  const [marks, setMarks] = useState<RecurringPaymentMark[]>(initialMarks);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [promoWarningDays, setPromoWarningDays] = useState<number>(initialPromoWarningDays);

  // Dialog states
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleFormSeq, setRuleFormSeq] = useState(0);
  const [editingRule, setEditingRule] = useState<SavingsRule | null>(null);
  const [presetRuleAccountId, setPresetRuleAccountId] = useState<string | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentFormSeq, setPaymentFormSeq] = useState(0);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(null);

  const openRuleForm = (rule: SavingsRule | null, presetAccountId: string | null = null) => {
    setEditingRule(rule);
    setPresetRuleAccountId(presetAccountId);
    setRuleFormSeq((n) => n + 1);
    setRuleDialogOpen(true);
  };

  const openPaymentForm = (payment: RecurringPayment | null) => {
    setEditingPayment(payment);
    setPaymentFormSeq((n) => n + 1);
    setPaymentDialogOpen(true);
  };

  const refreshData = useCallback(async () => {
    try {
      const [accRes, catRes, rulesRes, recRes, txRes] = await Promise.all([
        fetch("/api/v1/accounts"),
        fetch("/api/v1/categories"),
        fetch("/api/v1/savings-rules"),
        fetch("/api/v1/recurring-payments"),
        fetch("/api/v1/transactions?status=confirmed&limit=200"),
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
      if (rulesRes.ok) {
        const json = (await rulesRes.json()) as { savings_rules: SavingsRule[] };
        setSavingsRules(json.savings_rules);
      }
      if (recRes.ok) {
        const json = (await recRes.json()) as {
          recurring_payments: RecurringPayment[];
          marks: RecurringPaymentMark[];
        };
        setRecurringPayments(json.recurring_payments);
        setMarks(json.marks);
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
  }, [setReferenceData]);

  useEffect(() => {
    return registerOnMutated(() => {
      void refreshData();
    });
  }, [registerOnMutated, refreshData]);

  const coreAccounts = useMemo(() => accounts.map(toCoreAccount), [accounts]);
  const coreTransactions = useMemo(() => transactions.map(toCoreTransaction), [transactions]);
  const coreRules = useMemo(() => savingsRules.map(toCoreSavingsRule), [savingsRules]);
  const corePayments = useMemo(
    () => recurringPayments.map(toCoreRecurringPayment),
    [recurringPayments]
  );
  const coreMarks = useMemo(() => marks.map(toCoreRecurringPaymentMark), [marks]);

  const balances = useMemo(
    () => computeAllAccountBalances(coreAccounts, coreTransactions),
    [coreAccounts, coreTransactions]
  );

  const savingsSummary = useMemo(
    () =>
      computeSavingsPortfolioSummary(
        coreAccounts,
        coreRules,
        balances,
        asOfDate,
        promoWarningDays
      ),
    [coreAccounts, coreRules, balances, asOfDate, promoWarningDays]
  );

  const currentRecurringSummary = useMemo(
    () =>
      evaluateRecurringPayments({
        payments: corePayments,
        marks: coreMarks,
        transactions: coreTransactions,
        year: currentYear,
        month: currentMonth,
        asOfDate,
      }),
    [corePayments, coreMarks, coreTransactions, currentYear, currentMonth, asOfDate]
  );

  const existingRuleAccountIds = useMemo(
    () => new Set(savingsRules.map((r) => r.account_id)),
    [savingsRules]
  );

  const hasEligibleAccountsWithoutRule = useMemo(
    () =>
      accounts.some(
        (a) =>
          a.is_active &&
          !a.deleted_at &&
          (a.type === "savings" || a.type === "deposit" || a.type === "debit") &&
          !existingRuleAccountIds.has(a.id)
      ),
    [accounts, existingRuleAccountIds]
  );

  const hasSavingsAlerts = savingsSummary.alertCount > 0;
  const hasRecurringAlerts =
    currentRecurringSummary.overdueCount > 0 || currentRecurringSummary.dueSoonCount > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.plans.title}
          </h1>

          {activeTab === "savings" ? (
            <Button
              type="button"
              disabled={!hasEligibleAccountsWithoutRule}
              onClick={() => openRuleForm(null, null)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.plans.actions.addRule}</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => openPaymentForm(null)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.plans.actions.addPayment}</span>
            </Button>
          )}
        </div>
        <p className="text-sm text-[var(--strata-text-muted)]">{t.plans.subtitle}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val === "recurring" ? "recurring" : "savings")}
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto sm:min-w-[340px]">
          <TabsTrigger value="savings" className="gap-1.5">
            <span className="truncate">{t.plans.tabs.savings}</span>
            <span className="strata-mono text-[11px] opacity-75">
              ({savingsSummary.items.length})
            </span>
            {hasSavingsAlerts ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--strata-radar-warn)]"
              />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5">
            <span className="truncate">{t.plans.tabs.recurring}</span>
            <span className="strata-mono text-[11px] opacity-75">
              ({currentRecurringSummary.activeCount})
            </span>
            {hasRecurringAlerts ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--strata-radar-expired)]"
              />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="savings" className="space-y-5">
          <SavingsRadarSection
            baseCurrency={baseCurrency}
            accounts={accounts}
            savingsRules={savingsRules}
            balances={balances}
            summary={savingsSummary}
            promoWarningDays={promoWarningDays}
            onWarningDaysChange={setPromoWarningDays}
            onOpenRuleForm={openRuleForm}
            onRefresh={refreshData}
          />
        </TabsContent>

        <TabsContent value="recurring" className="space-y-5">
          <RecurringPaymentsSection
            baseCurrency={baseCurrency}
            accounts={accounts}
            categories={categories}
            recurringPayments={recurringPayments}
            marks={marks}
            transactions={transactions}
            currentYear={currentYear}
            currentMonth={currentMonth}
            asOfDate={asOfDate}
            onOpenPaymentForm={openPaymentForm}
            onRefresh={refreshData}
          />
        </TabsContent>
      </Tabs>

      <SavingsRuleFormDialog
        open={ruleDialogOpen}
        formSeq={ruleFormSeq}
        onOpenChange={setRuleDialogOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        balances={balances}
        existingRules={savingsRules}
        rule={editingRule}
        presetAccountId={presetRuleAccountId}
        promoWarningDays={promoWarningDays}
        asOfDate={asOfDate}
        onSuccess={refreshData}
      />

      <RecurringPaymentFormDialog
        open={paymentDialogOpen}
        formSeq={paymentFormSeq}
        onOpenChange={setPaymentDialogOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        categories={categories}
        payment={editingPayment}
        onSuccess={refreshData}
      />
    </div>
  );
}
