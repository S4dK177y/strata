"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { computeSavingsForecast } from "@strata/finance-core";
import type {
  Account,
  SavingsAccrualType,
  SavingsRule,
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
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";
import { cn, minorToEditableInput, parseAmountInputToMinor } from "@/lib/utils";

interface SavingsRuleFormDialogProps {
  open: boolean;
  formSeq: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  balances: Record<string, number>;
  existingRules: SavingsRule[];
  rule?: SavingsRule | null;
  presetAccountId?: string | null;
  promoWarningDays: number;
  asOfDate: string;
  onSuccess: () => void;
}

const ELIGIBLE_TYPES = new Set(["savings", "deposit", "debit"]);
const TYPE_PRIORITY: Record<string, number> = {
  savings: 0,
  deposit: 1,
  debit: 2,
};

function parsePercentRate(raw: string): number | null {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return 0;
  const num = Number(clean);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return Math.round(num * 1000) / 100_000;
}

function formatRatePercentInput(decimalRate: number): string {
  const pct = Math.round(decimalRate * 100_000) / 1000;
  return String(pct);
}

function SavingsRuleFormBody({
  baseCurrency,
  accounts,
  balances,
  existingRules,
  rule,
  presetAccountId,
  promoWarningDays,
  asOfDate,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  accounts: Account[];
  balances: Record<string, number>;
  existingRules: SavingsRule[];
  rule?: SavingsRule | null;
  presetAccountId?: string | null;
  promoWarningDays: number;
  asOfDate: string;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { t } = useI18n();
  const isEditing = Boolean(rule);

  const eligibleAccounts = useMemo(() => {
    const takenIds = new Set(existingRules.map((r) => r.account_id));
    return accounts
      .filter(
        (a) =>
          !a.deleted_at &&
          a.is_active &&
          ELIGIBLE_TYPES.has(a.type) &&
          (isEditing ? a.id === rule?.account_id : !takenIds.has(a.id))
      )
      .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9));
  }, [accounts, existingRules, isEditing, rule]);

  const defaultAccountId =
    rule?.account_id ?? presetAccountId ?? eligibleAccounts[0]?.id ?? "";

  const [accountId, setAccountId] = useState(defaultAccountId);
  const [accrualType, setAccrualType] = useState<SavingsAccrualType>(
    rule?.accrual_type ?? "daily_balance"
  );
  const [baseRateInput, setBaseRateInput] = useState(
    rule ? formatRatePercentInput(Number(rule.base_rate)) : "10"
  );
  const [promoRateInput, setPromoRateInput] = useState(
    rule && Number(rule.promo_rate) > 0 ? formatRatePercentInput(Number(rule.promo_rate)) : ""
  );
  const [promoEndDate, setPromoEndDate] = useState(rule?.promo_end_date ?? "");
  const [capitalization, setCapitalization] = useState(rule?.capitalization ?? true);
  const [minBalanceInput, setMinBalanceInput] = useState(
    rule?.min_balance_override_minor != null
      ? minorToEditableInput(rule.min_balance_override_minor)
      : ""
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const parsedBaseRate = useMemo(() => parsePercentRate(baseRateInput), [baseRateInput]);
  const parsedPromoRate = useMemo(() => parsePercentRate(promoRateInput), [promoRateInput]);
  const parsedMinOverride = useMemo(() => {
    if (accrualType !== "min_balance" || !minBalanceInput.trim()) return null;
    return parseAmountInputToMinor(minBalanceInput);
  }, [accrualType, minBalanceInput]);

  const previewForecast = useMemo(() => {
    if (parsedBaseRate === null || parsedPromoRate === null) return null;
    const balanceMinor = selectedAccount
      ? (balances[selectedAccount.id] ?? selectedAccount.initial_balance_minor)
      : 0;
    return computeSavingsForecast(
      {
        id: rule?.id ?? "preview",
        accountId: accountId || "preview",
        accrualType,
        baseRate: parsedBaseRate,
        promoRate: parsedPromoRate,
        promoEndDate: parsedPromoRate > 0 && promoEndDate ? promoEndDate : null,
        capitalization,
        minBalanceOverrideMinor: parsedMinOverride,
      },
      balanceMinor,
      asOfDate,
      promoWarningDays
    );
  }, [
    parsedBaseRate,
    parsedPromoRate,
    selectedAccount,
    balances,
    rule?.id,
    accountId,
    accrualType,
    promoEndDate,
    capitalization,
    parsedMinOverride,
    asOfDate,
    promoWarningDays,
  ]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!accountId) {
      toast.error(t.plans.savings.noEligibleAccounts);
      return;
    }
    if (parsedBaseRate === null || parsedPromoRate === null) {
      toast.error(t.plans.savings.form.invalidRate);
      return;
    }
    if (parsedPromoRate > 0 && !promoEndDate) {
      toast.error(t.plans.savings.form.promoDateRequired);
      return;
    }
    if (
      accrualType === "min_balance" &&
      minBalanceInput.trim().length > 0 &&
      parsedMinOverride === null
    ) {
      toast.error(t.errors.invalidAmount);
      return;
    }

    setSubmitting(true);
    try {
      const payload = isEditing
        ? {
            accrual_type: accrualType,
            base_rate: parsedBaseRate,
            promo_rate: parsedPromoRate,
            promo_end_date: parsedPromoRate > 0 ? promoEndDate : null,
            capitalization,
            min_balance_override_minor:
              accrualType === "min_balance" ? parsedMinOverride : null,
          }
        : {
            account_id: accountId,
            accrual_type: accrualType,
            base_rate: parsedBaseRate,
            promo_rate: parsedPromoRate,
            promo_end_date: parsedPromoRate > 0 ? promoEndDate : null,
            capitalization,
            min_balance_override_minor:
              accrualType === "min_balance" ? parsedMinOverride : null,
          };

      const res = await fetch(
        isEditing && rule ? `/api/v1/savings-rules/${rule.id}` : "/api/v1/savings-rules",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        if (err?.error === "SAVINGS_RULE_EXISTS") {
          toast.error(t.plans.savings.duplicateRuleError);
        } else {
          toast.error(t.errors.generic);
        }
        return;
      }

      toast.success(
        isEditing ? t.plans.savings.updatedToast : t.plans.savings.createdToast
      );
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
        <Label>{t.plans.savings.form.accountLabel}</Label>
        {isEditing && selectedAccount ? (
          <div className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] px-3.5 py-2 text-sm">
            <span className="truncate font-semibold text-[var(--strata-text-primary)]">
              {selectedAccount.name}
            </span>
            <span className="shrink-0 text-xs text-[var(--strata-text-muted)]">
              <AmountText
                minor={balances[selectedAccount.id] ?? selectedAccount.initial_balance_minor}
                currency={selectedAccount.currency}
              />
            </span>
          </div>
        ) : (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={t.plans.savings.form.accountPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {eligibleAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name} ({t.onboarding.accountTypes[acc.type]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t.plans.savings.form.accrualTypeLabel}</Label>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-1">
          {(["daily_balance", "min_balance"] as const).map((mode) => {
            const active = accrualType === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setAccrualType(mode)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 cursor-pointer rounded-xl px-2.5 text-xs font-semibold transition",
                  active
                    ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
                    : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                {mode === "daily_balance"
                  ? t.plans.savings.accrualDaily
                  : t.plans.savings.accrualMinBalance}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sr-base-rate">{t.plans.savings.form.baseRateLabel}</Label>
          <Input
            id="sr-base-rate"
            inputMode="decimal"
            value={baseRateInput}
            onChange={(e) => setBaseRateInput(e.target.value)}
            placeholder="10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sr-promo-rate">{t.plans.savings.form.promoRateLabel}</Label>
          <Input
            id="sr-promo-rate"
            inputMode="decimal"
            value={promoRateInput}
            onChange={(e) => setPromoRateInput(e.target.value)}
            placeholder="16"
          />
        </div>
      </div>

      {parsedPromoRate !== null && parsedPromoRate > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="sr-promo-end">{t.plans.savings.form.promoEndDateLabel}</Label>
          <Input
            id="sr-promo-end"
            type="date"
            value={promoEndDate}
            onChange={(e) => setPromoEndDate(e.target.value)}
          />
        </div>
      ) : null}

      {accrualType === "min_balance" ? (
        <div className="space-y-1.5">
          <Label htmlFor="sr-min-override">
            {t.plans.savings.form.minBalanceOverrideLabel}
          </Label>
          <Input
            id="sr-min-override"
            inputMode="decimal"
            value={minBalanceInput}
            onChange={(e) => setMinBalanceInput(e.target.value)}
            placeholder={t.plans.savings.form.minBalanceOverridePlaceholder}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/65 px-3.5 py-2.5">
        <div className="min-w-0">
          <Label htmlFor="sr-cap" className="text-xs font-semibold">
            {t.plans.savings.form.capitalizationLabel}
          </Label>
          <p className="text-[11px] text-[var(--strata-text-muted)]">
            {t.plans.savings.form.capitalizationHint}
          </p>
        </div>
        <Switch id="sr-cap" checked={capitalization} onCheckedChange={setCapitalization} />
      </div>

      {previewForecast && selectedAccount ? (
        <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/80 p-3.5">
          <div className="text-[11px] font-medium text-[var(--strata-text-muted)]">
            {t.plans.savings.form.previewTitle}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--strata-text-muted)]">
                {t.plans.savings.monthlyForecast}
              </div>
              <div className="text-sm font-bold text-[var(--strata-money-income)]">
                <AmountText
                  minor={previewForecast.monthlyInterestMinor}
                  currency={selectedAccount.currency || baseCurrency}
                  showSign
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[var(--strata-text-muted)]">
                {t.plans.savings.annualForecast}
              </div>
              <div className="text-sm font-bold text-[var(--strata-money-income)]">
                <AmountText
                  minor={previewForecast.annualInterestMinor}
                  currency={selectedAccount.currency || baseCurrency}
                  showSign
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={submitting || !accountId}>
          {submitting
            ? t.common.saving
            : isEditing
              ? t.plans.savings.form.saveRule
              : t.plans.savings.form.createRule}
        </Button>
      </div>
    </form>
  );
}

export function SavingsRuleFormDialog({
  open,
  formSeq,
  onOpenChange,
  baseCurrency,
  accounts,
  balances,
  existingRules,
  rule,
  presetAccountId,
  promoWarningDays,
  asOfDate,
  onSuccess,
}: SavingsRuleFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!submitting}
      title={rule ? t.plans.savings.form.editTitle : t.plans.savings.form.createTitle}
    >
      <SavingsRuleFormBody
        key={`${rule?.id ?? presetAccountId ?? "new"}-${formSeq}`}
        baseCurrency={baseCurrency}
        accounts={accounts}
        balances={balances}
        existingRules={existingRules}
        rule={rule}
        presetAccountId={presetAccountId}
        promoWarningDays={promoWarningDays}
        asOfDate={asOfDate}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
