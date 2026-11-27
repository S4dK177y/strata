"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { computeGoalEnvelope, getEffectiveRate } from "@strata/finance-core";
import type {
  Account,
  Goal,
  GoalPriority,
  GoalTransfer,
  SavingsRule,
  Transaction,
} from "@strata/api-contract";
import { AmountText } from "@/components/ui/amount-text";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  toCoreAccount,
  toCoreGoalTransfer,
  toCoreSavingsRule,
  toCoreTransaction,
} from "@/lib/finance-mappers";
import { useI18n } from "@/lib/i18n/client";
import { cn, minorToEditableInput, parseAmountInputToMinor } from "@/lib/utils";

interface GoalFormDialogProps {
  open: boolean;
  formSeq: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  savingsRules: SavingsRule[];
  transactions: Transaction[];
  goalTransfers: GoalTransfer[];
  goal?: Goal | null;
  asOfDate: string;
  onSuccess: () => void;
}

const NONE_VALUE = "__none__";
const PRIORITY_OPTIONS: readonly GoalPriority[] = ["high", "medium", "low"];
const STORAGE_ACCOUNT_PRIORITY: Record<Account["type"], number> = {
  savings: 0,
  deposit: 1,
  debit: 2,
  cash: 3,
  credit: 4,
};

function GoalFormBody({
  baseCurrency,
  accounts,
  savingsRules,
  transactions,
  goalTransfers,
  goal,
  asOfDate,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  accounts: Account[];
  savingsRules: SavingsRule[];
  transactions: Transaction[];
  goalTransfers: GoalTransfer[];
  goal?: Goal | null;
  asOfDate: string;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const isEditing = Boolean(goal);

  const sortedAccounts = useMemo(
    () =>
      accounts
        .filter((a) => !a.deleted_at && a.is_active)
        .sort(
          (a, b) =>
            (STORAGE_ACCOUNT_PRIORITY[a.type] ?? 9) -
            (STORAGE_ACCOUNT_PRIORITY[b.type] ?? 9)
        ),
    [accounts]
  );

  const ruleMap = useMemo(
    () => new Map(savingsRules.filter((r) => !r.deleted_at).map((r) => [r.account_id, r])),
    [savingsRules]
  );

  const defaultStorageId = useMemo(() => {
    if (goal) return goal.storage_account_id ?? NONE_VALUE;
    const firstSavings = sortedAccounts.find(
      (a) => a.type === "savings" || a.type === "deposit"
    );
    return firstSavings?.id ?? NONE_VALUE;
  }, [goal, sortedAccounts]);

  const [name, setName] = useState(goal?.name ?? "");
  const [priority, setPriority] = useState<GoalPriority>(goal?.priority ?? "medium");
  const [targetInput, setTargetInput] = useState(
    goal ? minorToEditableInput(goal.target_amount_minor) : ""
  );
  const [initialInput, setInitialInput] = useState(
    goal && goal.initial_amount_minor > 0
      ? minorToEditableInput(goal.initial_amount_minor)
      : ""
  );
  const [monthlyPlanInput, setMonthlyPlanInput] = useState(
    goal && goal.monthly_plan_minor > 0 ? minorToEditableInput(goal.monthly_plan_minor) : ""
  );
  const [storageAccountId, setStorageAccountId] = useState(defaultStorageId);

  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);

  const parsedTargetMinor = useMemo(
    () => parseAmountInputToMinor(targetInput),
    [targetInput]
  );
  const parsedInitialMinor = useMemo(
    () => parseAmountInputToMinor(initialInput),
    [initialInput]
  );
  const parsedMonthlyMinor = useMemo(
    () => parseAmountInputToMinor(monthlyPlanInput),
    [monthlyPlanInput]
  );

  function formatRate(decimalRate: number): string {
    const pct = Math.round(decimalRate * 1000) / 10;
    return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      maximumFractionDigits: 2,
    }).format(pct)}%`;
  }

  function formatEstimatedMonth(yearMonth: string): string {
    const [y, m] = yearMonth.split("-").map(Number);
    if (!y || !m) return yearMonth;
    const formatted = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  const previewEnvelope = useMemo(() => {
    if (!parsedTargetMinor || parsedTargetMinor <= 0) return null;
    const resolvedInitial = parsedInitialMinor ?? 0;
    const resolvedMonthly = parsedMonthlyMinor ?? 0;
    const resolvedStorage = storageAccountId === NONE_VALUE ? null : storageAccountId;

    return computeGoalEnvelope(
      {
        id: goal?.id ?? "preview-goal",
        name: name.trim() || "Preview",
        priority,
        targetAmountMinor: parsedTargetMinor,
        initialAmountMinor: Math.max(0, resolvedInitial),
        monthlyPlanMinor: Math.max(0, resolvedMonthly),
        storageAccountId: resolvedStorage,
      },
      accounts.map(toCoreAccount),
      savingsRules.map(toCoreSavingsRule),
      transactions.map(toCoreTransaction),
      goalTransfers.map(toCoreGoalTransfer),
      asOfDate
    );
  }, [
    parsedTargetMinor,
    parsedInitialMinor,
    parsedMonthlyMinor,
    storageAccountId,
    goal?.id,
    name,
    priority,
    accounts,
    savingsRules,
    transactions,
    goalTransfers,
    asOfDate,
  ]);

  const previewCurrency = useMemo(() => {
    if (storageAccountId !== NONE_VALUE) {
      return accounts.find((a) => a.id === storageAccountId)?.currency ?? baseCurrency;
    }
    return baseCurrency;
  }, [accounts, baseCurrency, storageAccountId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) {
      toast.error(t.errors.nameRequired);
      nameRef.current?.focus();
      return;
    }
    if (parsedTargetMinor === null || parsedTargetMinor <= 0) {
      toast.error(t.plans.goals.form.invalidTarget);
      targetRef.current?.focus();
      return;
    }
    if (parsedInitialMinor === null || parsedMonthlyMinor === null) {
      toast.error(t.errors.invalidAmount);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        priority,
        target_amount_minor: parsedTargetMinor,
        initial_amount_minor: parsedInitialMinor,
        monthly_plan_minor: parsedMonthlyMinor,
        storage_account_id: storageAccountId === NONE_VALUE ? null : storageAccountId,
      };

      const res = await fetch(
        isEditing && goal ? `/api/v1/goals/${goal.id}` : "/api/v1/goals",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      toast.success(isEditing ? t.plans.goals.updatedToast : t.plans.goals.createdToast);
      onClose();
      onSuccess();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">{t.plans.goals.form.nameLabel}</Label>
        <Input
          ref={nameRef}
          id="goal-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.plans.goals.form.namePlaceholder}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.plans.goals.form.priorityLabel}</Label>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-1">
          {PRIORITY_OPTIONS.map((opt) => {
            const active = priority === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setPriority(opt)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 cursor-pointer rounded-xl px-2 text-xs font-semibold transition",
                  active
                    ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
                    : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                {t.plans.goals.priority[opt]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">
            {t.plans.goals.form.targetAmountLabel} ({previewCurrency})
          </Label>
          <Input
            ref={targetRef}
            id="goal-target"
            inputMode="decimal"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="100000"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal-initial">
            {t.plans.goals.form.initialAmountLabel} ({previewCurrency})
          </Label>
          <Input
            id="goal-initial"
            inputMode="decimal"
            value={initialInput}
            onChange={(e) => setInitialInput(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="goal-monthly">
            {t.plans.goals.form.monthlyPlanLabel} ({previewCurrency})
          </Label>
          <Input
            id="goal-monthly"
            inputMode="decimal"
            value={monthlyPlanInput}
            onChange={(e) => setMonthlyPlanInput(e.target.value)}
            placeholder="15000"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t.plans.goals.form.storageAccountLabel}</Label>
          <Select value={storageAccountId} onValueChange={setStorageAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>{t.plans.goals.form.noStorageAccount}</SelectItem>
              {sortedAccounts.map((acc) => {
                const rule = ruleMap.get(acc.id);
                const rate = rule ? getEffectiveRate(toCoreSavingsRule(rule), asOfDate) : 0;
                return (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                    {rate > 0 ? ` (${formatRate(rate)})` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-[11px] text-[var(--strata-text-muted)]">
        {t.plans.goals.form.storageAccountHint}
      </p>

      {previewEnvelope ? (
        <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/80 p-3.5">
          <div className="text-[11px] font-medium text-[var(--strata-text-muted)]">
            {t.plans.goals.form.previewTitle}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--strata-text-muted)]">
                {t.plans.goals.nperTitle}
              </div>
              <div className="strata-money text-sm font-bold text-[var(--strata-text-primary)]">
                {previewEnvelope.isAchieved
                  ? t.plans.goals.nperAchieved
                  : previewEnvelope.monthsToGoal !== null && previewEnvelope.estimatedYearMonth
                    ? `${t.plans.goals.nperMonths.replace(
                        "{months}",
                        String(previewEnvelope.monthsToGoal)
                      )} · ${formatEstimatedMonth(previewEnvelope.estimatedYearMonth)}`
                    : "—"}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--strata-text-muted)]">
                {t.plans.goals.remainingLabel}
              </div>
              <div className="text-sm font-bold text-[var(--strata-text-primary)]">
                <AmountText minor={previewEnvelope.remainingMinor} currency={previewCurrency} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t.common.saving
            : isEditing
              ? t.plans.goals.form.saveGoal
              : t.plans.goals.form.createGoal}
        </Button>
      </div>
    </form>
  );
}

export function GoalFormDialog({
  open,
  formSeq,
  onOpenChange,
  baseCurrency,
  accounts,
  savingsRules,
  transactions,
  goalTransfers,
  goal,
  asOfDate,
  onSuccess,
}: GoalFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!submitting}
      title={goal ? t.plans.goals.form.editTitle : t.plans.goals.form.createTitle}
    >
      <GoalFormBody
        key={`${goal?.id ?? "new"}-${formSeq}`}
        baseCurrency={baseCurrency}
        accounts={accounts}
        savingsRules={savingsRules}
        transactions={transactions}
        goalTransfers={goalTransfers}
        goal={goal}
        asOfDate={asOfDate}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
