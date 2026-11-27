"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { evaluateAmountExpression } from "@strata/finance-core";
import type {
  Account,
  Category,
  RecurringCadence,
  RecurringPayment,
} from "@strata/api-contract";
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
import { minorToEditableInput } from "@/lib/utils";

interface RecurringPaymentFormDialogProps {
  open: boolean;
  formSeq: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  payment?: RecurringPayment | null;
  onSuccess: () => void;
}

const NONE_VALUE = "__none__";
const CADENCE_OPTIONS: readonly RecurringCadence[] = [
  "monthly",
  "weekly",
  "quarterly",
  "yearly",
];

function RecurringPaymentFormBody({
  baseCurrency,
  accounts,
  categories,
  payment,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  payment?: RecurringPayment | null;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { t } = useI18n();
  const isEditing = Boolean(payment);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.deleted_at && a.is_active),
    [accounts]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.deleted_at && c.kind === "expense"),
    [categories]
  );

  const [name, setName] = useState(payment?.name ?? "");
  const [amountInput, setAmountInput] = useState(
    payment ? minorToEditableInput(payment.amount_minor) : ""
  );
  const [cadence, setCadence] = useState<RecurringCadence>(
    payment?.cadence ?? "monthly"
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    payment ? String(payment.day_of_month) : "15"
  );
  const [accountId, setAccountId] = useState(
    payment?.account_id ?? activeAccounts[0]?.id ?? NONE_VALUE
  );
  const [categoryId, setCategoryId] = useState(payment?.category_id ?? NONE_VALUE);
  const [matchKeyword, setMatchKeyword] = useState(payment?.match_keyword ?? "");
  const [isActive, setIsActive] = useState(payment?.is_active ?? true);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const parsedMinor = useMemo(
    () => evaluateAmountExpression(amountInput),
    [amountInput]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) {
      toast.error(t.errors.nameRequired);
      nameRef.current?.focus();
      return;
    }
    if (parsedMinor === null) {
      toast.error(t.errors.invalidAmount);
      amountRef.current?.focus();
      return;
    }

    const parsedDay = Math.trunc(Number(dayOfMonth));
    if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      toast.error(t.errors.generic);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        amount_minor: parsedMinor,
        cadence,
        day_of_month: parsedDay,
        account_id: accountId === NONE_VALUE ? null : accountId,
        category_id: categoryId === NONE_VALUE ? null : categoryId,
        match_keyword: matchKeyword.trim() || null,
        is_active: isActive,
      };

      const res = await fetch(
        isEditing && payment
          ? `/api/v1/recurring-payments/${payment.id}`
          : "/api/v1/recurring-payments",
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
        isEditing ? t.plans.recurring.updatedToast : t.plans.recurring.createdToast
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
        <Label htmlFor="rp-name">{t.plans.recurring.form.nameLabel}</Label>
        <Input
          ref={nameRef}
          id="rp-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.plans.recurring.form.namePlaceholder}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rp-amount">
            {t.plans.recurring.form.amountLabel} ({baseCurrency})
          </Label>
          <Input
            ref={amountRef}
            id="rp-amount"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="750"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rp-day">{t.plans.recurring.form.dayOfMonthLabel}</Label>
          <Input
            id="rp-day"
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t.plans.recurring.form.cadenceLabel}</Label>
          <Select
            value={cadence}
            onValueChange={(val) => setCadence(val as RecurringCadence)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {t.plans.recurring.cadence[opt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t.plans.recurring.form.accountLabel}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>{t.plans.recurring.form.noAccount}</SelectItem>
              {activeAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t.plans.recurring.form.categoryLabel}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>{t.plans.recurring.form.noCategory}</SelectItem>
            {expenseCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rp-keyword">{t.plans.recurring.form.keywordLabel}</Label>
        <Input
          id="rp-keyword"
          value={matchKeyword}
          onChange={(e) => setMatchKeyword(e.target.value)}
          placeholder={t.plans.recurring.form.keywordPlaceholder}
        />
        <p className="text-[11px] text-[var(--strata-text-muted)]">
          {t.plans.recurring.form.keywordHint}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/65 px-3.5 py-2.5">
        <div className="min-w-0">
          <Label htmlFor="rp-active" className="text-xs font-semibold">
            {t.plans.recurring.form.isActiveLabel}
          </Label>
          <p className="text-[11px] text-[var(--strata-text-muted)]">
            {t.plans.recurring.form.isActiveHint}
          </p>
        </div>
        <Switch id="rp-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? t.common.saving
            : isEditing
              ? t.plans.recurring.form.savePayment
              : t.plans.recurring.form.createPayment}
        </Button>
      </div>
    </form>
  );
}

export function RecurringPaymentFormDialog({
  open,
  formSeq,
  onOpenChange,
  baseCurrency,
  accounts,
  categories,
  payment,
  onSuccess,
}: RecurringPaymentFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!submitting}
      title={
        payment ? t.plans.recurring.form.editTitle : t.plans.recurring.form.createTitle
      }
    >
      <RecurringPaymentFormBody
        key={`${payment?.id ?? "new"}-${formSeq}`}
        baseCurrency={baseCurrency}
        accounts={accounts}
        categories={categories}
        payment={payment}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
