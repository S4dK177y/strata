"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { evaluateAmountExpression } from "@strata/finance-core";
import type { Account, Debt, DebtDirection } from "@strata/api-contract";
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

interface DebtFormDialogProps {
  open: boolean;
  formSeq: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  debt?: Debt | null;
  asOfDate: string;
  onSuccess: () => void;
}

function DebtFormBody({
  baseCurrency,
  accounts,
  debt,
  asOfDate,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  accounts: Account[];
  debt?: Debt | null;
  asOfDate: string;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { t } = useI18n();
  const isEditing = Boolean(debt);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.deleted_at && a.is_active),
    [accounts]
  );

  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? "lent");
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? "");
  const [amountInput, setAmountInput] = useState(
    debt ? minorToEditableInput(debt.amount_minor) : ""
  );
  const [openedAt, setOpenedAt] = useState(debt?.opened_at ?? asOfDate);
  const [dueDate, setDueDate] = useState(debt?.due_date ?? "");
  const [manualRepaidInput, setManualRepaidInput] = useState(
    debt && debt.manual_repaid_minor > 0
      ? minorToEditableInput(debt.manual_repaid_minor)
      : ""
  );
  const [comment, setComment] = useState(debt?.comment ?? "");
  const [createLinkedTx, setCreateLinkedTx] = useState(false);
  const [linkedAccountId, setLinkedAccountId] = useState(activeAccounts[0]?.id ?? "");

  const counterpartyRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const parsedAmountMinor = useMemo(
    () => evaluateAmountExpression(amountInput),
    [amountInput]
  );
  const parsedManualMinor = useMemo(
    () => parseAmountInputToMinor(manualRepaidInput),
    [manualRepaidInput]
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanCounterparty = counterparty.trim();
    if (!cleanCounterparty) {
      toast.error(t.plans.debts.form.counterpartyRequired);
      counterpartyRef.current?.focus();
      return;
    }
    if (parsedAmountMinor === null) {
      toast.error(t.errors.invalidAmount);
      amountRef.current?.focus();
      return;
    }
    if (parsedManualMinor === null) {
      toast.error(t.errors.invalidAmount);
      return;
    }
    if (parsedManualMinor > parsedAmountMinor) {
      toast.error(t.plans.debts.form.manualExceedsAmount);
      return;
    }
    if (!isEditing && createLinkedTx && !linkedAccountId) {
      toast.error(t.errors.accountRequired);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        direction,
        counterparty: cleanCounterparty,
        amount_minor: parsedAmountMinor,
        manual_repaid_minor: parsedManualMinor,
        opened_at: openedAt || asOfDate,
        due_date: dueDate ? dueDate : null,
        comment: comment.trim(),
      };

      const res = await fetch(
        isEditing && debt ? `/api/v1/debts/${debt.id}` : "/api/v1/debts",
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

      const createdJson = (await res.json()) as { debt: Debt };

      if (!isEditing && createLinkedTx && linkedAccountId) {
        const txRes = await fetch("/api/v1/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occurred_at: new Date(`${(openedAt || asOfDate).slice(0, 10)}T12:00:00Z`).toISOString(),
            type: direction === "lent" ? "debt_given" : "debt_borrowed",
            amount_minor: parsedAmountMinor,
            account_from_id: linkedAccountId,
            debt_id: createdJson.debt.id,
            comment: cleanCounterparty,
            status: "confirmed",
            source: "web",
          }),
        });
        if (!txRes.ok) {
          toast.error(t.errors.generic);
          onClose();
          onSuccess();
          return;
        }
        toast.success(t.plans.debts.createdWithTxToast);
      } else {
        toast.success(isEditing ? t.plans.debts.updatedToast : t.plans.debts.createdToast);
      }

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
        <Label>{t.plans.debts.form.directionLabel}</Label>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-1">
          {(["lent", "borrowed"] as const).map((opt) => {
            const active = direction === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setDirection(opt)}
                aria-pressed={active}
                className={cn(
                  "min-h-9 cursor-pointer rounded-xl px-2.5 text-xs font-semibold transition",
                  active
                    ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
                    : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                {opt === "lent" ? t.plans.debts.directionLent : t.plans.debts.directionBorrowed}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debt-counterparty">{t.plans.debts.form.counterpartyLabel}</Label>
          <Input
            ref={counterpartyRef}
            id="debt-counterparty"
            autoFocus
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder={t.plans.debts.form.counterpartyPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="debt-amount">
            {t.plans.debts.form.amountLabel} ({baseCurrency})
          </Label>
          <Input
            ref={amountRef}
            id="debt-amount"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="5000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debt-opened">{t.plans.debts.form.openedAtLabel}</Label>
          <Input
            id="debt-opened"
            type="date"
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="debt-due">{t.plans.debts.form.dueDateLabel}</Label>
          <Input
            id="debt-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debt-manual">
            {t.plans.debts.form.manualRepaidLabel} ({baseCurrency})
          </Label>
          <Input
            id="debt-manual"
            inputMode="decimal"
            value={manualRepaidInput}
            onChange={(e) => setManualRepaidInput(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="debt-comment">{t.plans.debts.form.commentLabel}</Label>
          <Input
            id="debt-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.plans.debts.form.commentPlaceholder}
          />
        </div>
      </div>

      {!isEditing && activeAccounts.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/65 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="debt-create-tx" className="text-xs font-semibold">
                {t.plans.debts.form.createTxToggleLabel}
              </Label>
              <p className="text-[11px] text-[var(--strata-text-muted)]">
                {t.plans.debts.form.createTxToggleHint}
              </p>
            </div>
            <Switch
              id="debt-create-tx"
              checked={createLinkedTx}
              onCheckedChange={setCreateLinkedTx}
            />
          </div>

          {createLinkedTx ? (
            <div className="space-y-1.5">
              <Label>{t.plans.debts.form.accountLabel}</Label>
              <Select value={linkedAccountId} onValueChange={setLinkedAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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
              ? t.plans.debts.form.saveDebt
              : t.plans.debts.form.createDebt}
        </Button>
      </div>
    </form>
  );
}

export function DebtFormDialog({
  open,
  formSeq,
  onOpenChange,
  baseCurrency,
  accounts,
  debt,
  asOfDate,
  onSuccess,
}: DebtFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!submitting}
      title={debt ? t.plans.debts.form.editTitle : t.plans.debts.form.createTitle}
    >
      <DebtFormBody
        key={`${debt?.id ?? "new"}-${formSeq}`}
        baseCurrency={baseCurrency}
        accounts={accounts}
        debt={debt}
        asOfDate={asOfDate}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
