"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Account, AccountType } from "@strata/api-contract";
import { SUPPORTED_CURRENCIES } from "@/components/onboarding/starter-templates";
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
import {
  cn,
  minorToEditableInput,
  parseAmountInputToMinor,
  parseSignedAmountInputToMinor,
} from "@/lib/utils";

interface AccountFormDialogProps {
  open: boolean;
  formSeq?: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  account?: Account | null;
  onSuccess: () => void;
}

const ACCOUNT_TYPES: readonly AccountType[] = [
  "debit",
  "credit",
  "cash",
  "savings",
  "deposit",
];

function AccountFormBody({
  baseCurrency,
  account,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  account?: Account | null;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const isEditing = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const [type, setType] = useState<AccountType>(account?.type ?? "debit");
  const [currency, setCurrency] = useState(account?.currency ?? baseCurrency);
  const [balanceInput, setBalanceInput] = useState(
    account ? minorToEditableInput(account.initial_balance_minor) : "0"
  );
  const [balanceTouched, setBalanceTouched] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState(
    account ? minorToEditableInput(account.credit_limit_minor) : "0"
  );
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [last4Digits, setLast4Digits] = useState(account?.last4_digits ?? "");
  const [isActive, setIsActive] = useState(account?.is_active ?? true);

  const nameRef = useRef<HTMLInputElement>(null);
  const balanceRef = useRef<HTMLInputElement>(null);
  const nameErrorId = useId();
  const balanceErrorId = useId();

  const parsedBalanceMinor = useMemo(
    () => parseSignedAmountInputToMinor(balanceInput),
    [balanceInput]
  );
  const parsedLimitMinor = useMemo(
    () => parseAmountInputToMinor(creditLimitInput),
    [creditLimitInput]
  );

  const nameInvalid = nameTouched && name.trim().length === 0;
  const balanceInvalid = balanceTouched && parsedBalanceMinor === null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameTouched(true);
    setBalanceTouched(true);

    if (name.trim().length === 0) {
      nameRef.current?.focus();
      return;
    }
    if (parsedBalanceMinor === null) {
      balanceRef.current?.focus();
      return;
    }
    if (type === "credit" && (parsedLimitMinor === null || parsedLimitMinor < 0)) {
      toast.error(t.errors.invalidAmount);
      return;
    }
    const cleanLast4 = last4Digits.trim();
    if (cleanLast4.length > 0 && !/^\d{4}$/.test(cleanLast4)) {
      toast.error(t.errors.invalidLast4);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        currency,
        initial_balance_minor: parsedBalanceMinor,
        credit_limit_minor: type === "credit" ? (parsedLimitMinor ?? 0) : 0,
        bank_name: bankName.trim() || null,
        last4_digits: cleanLast4 || null,
        is_active: isActive,
      };

      const res = await fetch(
        isEditing && account ? `/api/v1/accounts/${account.id}` : "/api/v1/accounts",
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

      toast.success(
        isEditing ? t.capital.accountUpdatedToast : t.capital.accountCreatedToast
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
        <Label htmlFor="acc-form-name">{t.onboarding.accountNameLabel}</Label>
        <Input
          ref={nameRef}
          id="acc-form-name"
          autoFocus
          value={name}
          aria-invalid={nameInvalid ? "true" : "false"}
          aria-describedby={nameInvalid ? nameErrorId : undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder={t.onboarding.accountNamePlaceholder}
          className={cn(nameInvalid && "border-[var(--strata-money-expense)]")}
        />
        {nameInvalid ? (
          <p id={nameErrorId} className="text-xs text-[var(--strata-money-expense)]">
            {t.errors.nameRequired}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t.onboarding.accountTypeLabel}</Label>
          <Select value={type} onValueChange={(val) => setType(val as AccountType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((typeKey) => (
                <SelectItem key={typeKey} value={typeKey}>
                  {t.onboarding.accountTypes[typeKey]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t.onboarding.currencyLabel}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((cur) => (
                <SelectItem key={cur.code} value={cur.code}>
                  {locale === "en" ? cur.labelEn : cur.labelRu}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="acc-form-balance">
            {t.onboarding.accountBalanceLabel} ({currency})
          </Label>
          {parsedBalanceMinor !== null ? (
            <span className="text-xs font-semibold text-[var(--strata-text-secondary)]">
              <AmountText
                minor={parsedBalanceMinor}
                currency={currency}
                mutedFraction={false}
              />
            </span>
          ) : null}
        </div>
        <Input
          ref={balanceRef}
          id="acc-form-balance"
          inputMode="decimal"
          value={balanceInput}
          aria-invalid={balanceInvalid ? "true" : "false"}
          aria-describedby={balanceInvalid ? balanceErrorId : undefined}
          onChange={(e) => setBalanceInput(e.target.value)}
          onBlur={() => setBalanceTouched(true)}
          className={cn(
            "strata-mono",
            balanceInvalid && "border-[var(--strata-money-expense)]"
          )}
        />
        <p className="text-xs text-[var(--strata-text-muted)]">
          {t.onboarding.accountBalanceHint}
        </p>
        {balanceInvalid ? (
          <p id={balanceErrorId} className="text-xs text-[var(--strata-money-expense)]">
            {t.errors.invalidAmount}
          </p>
        ) : null}
      </div>

      {type === "credit" ? (
        <div className="space-y-1.5">
          <Label htmlFor="acc-form-limit">
            {t.capital.creditLimitLabel} ({currency})
          </Label>
          <Input
            id="acc-form-limit"
            inputMode="decimal"
            value={creditLimitInput}
            onChange={(e) => setCreditLimitInput(e.target.value)}
            className="strata-mono"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-form-bank">{t.capital.bankNameLabel}</Label>
          <Input
            id="acc-form-bank"
            value={bankName}
            maxLength={120}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t.capital.bankNamePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="acc-form-last4">{t.capital.last4Label}</Label>
          <Input
            id="acc-form-last4"
            inputMode="numeric"
            maxLength={4}
            value={last4Digits}
            onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={t.capital.last4Placeholder}
            className="strata-mono"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
        <div className="space-y-0.5">
          <Label htmlFor="acc-form-active" className="text-sm font-semibold">
            {t.capital.activeSwitchLabel}
          </Label>
          <p className="text-xs text-[var(--strata-text-muted)]">
            {t.capital.activeSwitchHint}
          </p>
        </div>
        <Switch id="acc-form-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={onClose}
        >
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.common.save}
        </Button>
      </div>
    </form>
  );
}

export function AccountFormDialog({
  open,
  formSeq = 0,
  onOpenChange,
  baseCurrency,
  account,
  onSuccess,
}: AccountFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? t.capital.editAccount : t.capital.addAccount}
      dismissible={!submitting}
    >
      <AccountFormBody
        key={`${account?.id ?? "new"}-${formSeq}`}
        baseCurrency={baseCurrency}
        account={account}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
