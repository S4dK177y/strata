"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  computeAllAccountBalances,
  computeDebtsLedger,
  computeGoalsPortfolioSummary,
  computeSavingsPortfolioSummary,
  evaluateRecurringPayments,
} from "@strata/finance-core";
import type {
  Account,
  Category,
  Debt,
  Goal,
  GoalTransfer,
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
  toCoreDebt,
  toCoreGoal,
  toCoreGoalTransfer,
  toCoreRecurringPayment,
  toCoreRecurringPaymentMark,
  toCoreSavingsRule,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { DebtFormDialog } from "./debt-form-dialog";
import { DebtsSection } from "./debts-section";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalTransferDialog } from "./goal-transfer-dialog";
import { GoalsSection } from "./goals-section";
import { RecurringPaymentFormDialog } from "./recurring-payment-form-dialog";
import { RecurringPaymentsSection } from "./recurring-payments-section";
import { SavingsRadarSection } from "./savings-radar-section";
import { SavingsRuleFormDialog } from "./savings-rule-form-dialog";

export type PlansTab = "savings" | "recurring" | "goals" | "debts";

interface PlansClientProps {
  baseCurrency: string;
  initialTab: PlansTab;
  initialAccounts: Account[];
  initialCategories: Category[];
  initialSavingsRules: SavingsRule[];
  initialRecurringPayments: RecurringPayment[];
  initialMarks: RecurringPaymentMark[];
  initialGoals: Goal[];
  initialGoalTransfers: GoalTransfer[];
  initialDebts: Debt[];
  initialTransactions: Transaction[];
  initialPromoWarningDays: number;
  currentYear: number;
  currentMonth: number;
  asOfDate: string;
}

async function fetchAllConfirmedTransactions(): Promise<Transaction[] | null> {
  const all: Transaction[] = [];
  const limit = 200;

  for (let page = 0; page < 10; page += 1) {
    const offset = page * limit;
    const res = await fetch(
      `/api/v1/transactions?status=confirmed&limit=${limit}&offset=${offset}`
    );
    if (!res.ok) {
      return page === 0 ? null : all;
    }
    const json = (await res.json()) as {
      transactions: Transaction[];
      has_more: boolean;
    };
    all.push(...json.transactions);
    if (!json.has_more) break;
  }

  return all;
}

export function PlansClient({
  baseCurrency,
  initialTab,
  initialAccounts,
  initialCategories,
  initialSavingsRules,
  initialRecurringPayments,
  initialMarks,
  initialGoals,
  initialGoalTransfers,
  initialDebts,
  initialTransactions,
  initialPromoWarningDays,
  currentYear,
  currentMonth,
  asOfDate,
}: PlansClientProps) {
  const { t } = useI18n();
  const { registerOnMutated, setReferenceData } = useQuickAdd();

  const [activeTab, setActiveTab] = useState<PlansTab>(initialTab);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [savingsRules, setSavingsRules] = useState<SavingsRule[]>(initialSavingsRules);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>(
    initialRecurringPayments
  );
  const [marks, setMarks] = useState<RecurringPaymentMark[]>(initialMarks);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [goalTransfers, setGoalTransfers] = useState<GoalTransfer[]>(initialGoalTransfers);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
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

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalFormSeq, setGoalFormSeq] = useState(0);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [goalTransferOpen, setGoalTransferOpen] = useState(false);
  const [goalTransferSeq, setGoalTransferSeq] = useState(0);
  const [presetTransferFromId, setPresetTransferFromId] = useState<string | null>(null);

  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [debtFormSeq, setDebtFormSeq] = useState(0);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

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

  const openGoalForm = (goal: Goal | null) => {
    setEditingGoal(goal);
    setGoalFormSeq((n) => n + 1);
    setGoalDialogOpen(true);
  };

  const openGoalTransferDialog = (fromGoalId: string | null = null) => {
    setPresetTransferFromId(fromGoalId);
    setGoalTransferSeq((n) => n + 1);
    setGoalTransferOpen(true);
  };

  const openDebtForm = (debt: Debt | null) => {
    setEditingDebt(debt);
    setDebtFormSeq((n) => n + 1);
    setDebtDialogOpen(true);
  };

  const refreshSavingsRules = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/savings-rules");
      if (res.ok) {
        const json = (await res.json()) as { savings_rules: SavingsRule[] };
        setSavingsRules(json.savings_rules);
      }
    } catch {
      // ignore transient refresh failure
    }
  }, []);

  const refreshRecurring = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/recurring-payments");
      if (res.ok) {
        const json = (await res.json()) as {
          recurring_payments: RecurringPayment[];
          marks: RecurringPaymentMark[];
        };
        setRecurringPayments(json.recurring_payments);
        setMarks(json.marks);
      }
    } catch {
      // ignore transient refresh failure
    }
  }, []);

  const refreshGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/goals");
      if (res.ok) {
        const json = (await res.json()) as {
          goals: Goal[];
          goal_transfers: GoalTransfer[];
        };
        setGoals(json.goals);
        setGoalTransfers(json.goal_transfers);
        setReferenceData({ goals: json.goals });
      }
    } catch {
      // ignore transient refresh failure
    }
  }, [setReferenceData]);

  const refreshDebts = useCallback(async () => {
    try {
      const [debtsRes, allTxs] = await Promise.all([
        fetch("/api/v1/debts"),
        fetchAllConfirmedTransactions(),
      ]);
      if (debtsRes.ok) {
        const json = (await debtsRes.json()) as { debts: Debt[] };
        setDebts(json.debts);
        setReferenceData({ debts: json.debts });
      }
      if (allTxs !== null) {
        setTransactions(allTxs);
      }
    } catch {
      // ignore transient refresh failure
    }
  }, [setReferenceData]);

  const refreshAfterTx = useCallback(async () => {
    try {
      const [accRes, catRes, recRes, goalsRes, debtsRes, allTxs] = await Promise.all([
        fetch("/api/v1/accounts"),
        fetch("/api/v1/categories"),
        fetch("/api/v1/recurring-payments"),
        fetch("/api/v1/goals"),
        fetch("/api/v1/debts"),
        fetchAllConfirmedTransactions(),
      ]);

      let nextAccounts: Account[] | undefined;
      let nextCategories: Category[] | undefined;
      let nextGoals: Goal[] | undefined;
      let nextDebts: Debt[] | undefined;

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
      if (recRes.ok) {
        const json = (await recRes.json()) as {
          recurring_payments: RecurringPayment[];
          marks: RecurringPaymentMark[];
        };
        setRecurringPayments(json.recurring_payments);
        setMarks(json.marks);
      }
      if (goalsRes.ok) {
        const json = (await goalsRes.json()) as {
          goals: Goal[];
          goal_transfers: GoalTransfer[];
        };
        nextGoals = json.goals;
        setGoals(json.goals);
        setGoalTransfers(json.goal_transfers);
      }
      if (debtsRes.ok) {
        const json = (await debtsRes.json()) as { debts: Debt[] };
        nextDebts = json.debts;
        setDebts(json.debts);
      }
      if (allTxs !== null) {
        setTransactions(allTxs);
      }

      if (nextAccounts || nextCategories || nextGoals || nextDebts) {
        setReferenceData({
          ...(nextAccounts ? { accounts: nextAccounts } : {}),
          ...(nextCategories ? { categories: nextCategories } : {}),
          ...(nextGoals ? { goals: nextGoals } : {}),
          ...(nextDebts ? { debts: nextDebts } : {}),
        });
      }
    } catch {
      // ignore transient refresh failure
    }
  }, [setReferenceData]);

  useEffect(() => {
    return registerOnMutated(() => {
      void refreshAfterTx();
    });
  }, [registerOnMutated, refreshAfterTx]);

  const coreAccounts = useMemo(() => accounts.map(toCoreAccount), [accounts]);
  const coreTransactions = useMemo(() => transactions.map(toCoreTransaction), [transactions]);
  const coreRules = useMemo(() => savingsRules.map(toCoreSavingsRule), [savingsRules]);
  const corePayments = useMemo(
    () => recurringPayments.map(toCoreRecurringPayment),
    [recurringPayments]
  );
  const coreMarks = useMemo(() => marks.map(toCoreRecurringPaymentMark), [marks]);
  const coreGoals = useMemo(() => goals.map(toCoreGoal), [goals]);
  const coreGoalTransfers = useMemo(
    () => goalTransfers.map(toCoreGoalTransfer),
    [goalTransfers]
  );
  const coreDebts = useMemo(() => debts.map(toCoreDebt), [debts]);

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

  const goalsSummary = useMemo(
    () =>
      computeGoalsPortfolioSummary(
        coreGoals,
        coreAccounts,
        coreRules,
        balances,
        coreTransactions,
        coreGoalTransfers,
        asOfDate
      ),
    [coreGoals, coreAccounts, coreRules, balances, coreTransactions, coreGoalTransfers, asOfDate]
  );

  const debtsSummary = useMemo(
    () => computeDebtsLedger(coreDebts, coreTransactions, asOfDate),
    [coreDebts, coreTransactions, asOfDate]
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
  const hasDebtAlerts = debtsSummary.overdueCount > 0;

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
          ) : activeTab === "recurring" ? (
            <Button
              type="button"
              onClick={() => openPaymentForm(null)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.plans.actions.addPayment}</span>
            </Button>
          ) : activeTab === "goals" ? (
            <Button
              type="button"
              onClick={() => openGoalForm(null)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.plans.actions.addGoal}</span>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => openDebtForm(null)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>{t.plans.actions.addDebt}</span>
            </Button>
          )}
        </div>
        <p className="text-sm text-[var(--strata-text-muted)]">{t.plans.subtitle}</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          if (val === "recurring" || val === "goals" || val === "debts") {
            setActiveTab(val);
          } else {
            setActiveTab("savings");
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto sm:grid-cols-4">
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
          <TabsTrigger value="goals" className="gap-1.5">
            <span className="truncate">{t.plans.tabs.goals}</span>
            <span className="strata-mono text-[11px] opacity-75">
              ({goalsSummary.activeCount})
            </span>
          </TabsTrigger>
          <TabsTrigger value="debts" className="gap-1.5">
            <span className="truncate">{t.plans.tabs.debts}</span>
            <span className="strata-mono text-[11px] opacity-75">
              ({debtsSummary.openCount})
            </span>
            {hasDebtAlerts ? (
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
            categories={categories}
            savingsRules={savingsRules}
            balances={balances}
            summary={savingsSummary}
            promoWarningDays={promoWarningDays}
            onWarningDaysChange={setPromoWarningDays}
            onOpenRuleForm={openRuleForm}
            onRefresh={refreshSavingsRules}
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
            onRefresh={refreshRecurring}
          />
        </TabsContent>

        <TabsContent value="goals" className="space-y-5">
          <GoalsSection
            baseCurrency={baseCurrency}
            accounts={accounts}
            goals={goals}
            goalTransfers={goalTransfers}
            summary={goalsSummary}
            onOpenGoalForm={openGoalForm}
            onOpenTransferDialog={openGoalTransferDialog}
            onRefresh={refreshGoals}
          />
        </TabsContent>

        <TabsContent value="debts" className="space-y-5">
          <DebtsSection
            baseCurrency={baseCurrency}
            debts={debts}
            transactions={transactions}
            summary={debtsSummary}
            onOpenDebtForm={openDebtForm}
            onRefresh={refreshDebts}
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
        onSuccess={() => void refreshSavingsRules()}
      />

      <RecurringPaymentFormDialog
        open={paymentDialogOpen}
        formSeq={paymentFormSeq}
        onOpenChange={setPaymentDialogOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        categories={categories}
        payment={editingPayment}
        onSuccess={() => void refreshRecurring()}
      />

      <GoalFormDialog
        open={goalDialogOpen}
        formSeq={goalFormSeq}
        onOpenChange={setGoalDialogOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        savingsRules={savingsRules}
        transactions={transactions}
        goalTransfers={goalTransfers}
        goal={editingGoal}
        asOfDate={asOfDate}
        onSuccess={() => void refreshGoals()}
      />

      <GoalTransferDialog
        open={goalTransferOpen}
        formSeq={goalTransferSeq}
        onOpenChange={setGoalTransferOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        activeItems={goalsSummary.activeItems}
        presetFromGoalId={presetTransferFromId}
        onSuccess={() => void refreshGoals()}
      />

      <DebtFormDialog
        open={debtDialogOpen}
        formSeq={debtFormSeq}
        onOpenChange={setDebtDialogOpen}
        baseCurrency={baseCurrency}
        accounts={accounts}
        debt={editingDebt}
        asOfDate={asOfDate}
        onSuccess={() => void refreshDebts()}
      />
    </div>
  );
}
