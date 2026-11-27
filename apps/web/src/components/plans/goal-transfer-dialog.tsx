"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { evaluateAmountExpression, type GoalPortfolioItem } from "@strata/finance-core";
import type { Account } from "@strata/api-contract";
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
import { useI18n } from "@/lib/i18n/client";

interface GoalTransferDialogProps {
  open: boolean;
  formSeq: number;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  activeItems: GoalPortfolioItem[];
  presetFromGoalId?: string | null;
  onSuccess: () => void;
}

function GoalTransferBody({
  baseCurrency,
  accounts,
  activeItems,
  presetFromGoalId,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  accounts: Account[];
  activeItems: GoalPortfolioItem[];
  presetFromGoalId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { t } = useI18n();
  const initialFrom =
    presetFromGoalId && activeItems.some((item) => item.goal.id === presetFromGoalId)
      ? presetFromGoalId
      : activeItems[0]?.goal.id ?? "";
  const initialTo =
    activeItems.find((item) => item.goal.id !== initialFrom)?.goal.id ?? "";

  const [fromGoalId, setFromGoalId] = useState(initialFrom);
  const [toGoalId, setToGoalId] = useState(initialTo);
  const [amountInput, setAmountInput] = useState("");
  const [comment, setComment] = useState("");
  const [swapRotation, setSwapRotation] = useState(0);

  const amountRef = useRef<HTMLInputElement>(null);

  const itemMap = useMemo(
    () => new Map(activeItems.map((item) => [item.goal.id, item])),
    [activeItems]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((acc) => [acc.id, acc])),
    [accounts]
  );

  const parsedMinor = useMemo(() => evaluateAmountExpression(amountInput), [amountInput]);
  const fromItem = itemMap.get(fromGoalId) ?? null;
  const toItem = itemMap.get(toGoalId) ?? null;

  const exceedsSource =
    Boolean(fromItem && parsedMinor !== null && parsedMinor > fromItem.envelope.currentMinor);

  function handleSwap() {
    setFromGoalId(toGoalId);
    setToGoalId(fromGoalId);
    setSwapRotation((r) => r + 180);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!fromGoalId || !toGoalId || fromGoalId === toGoalId) {
      toast.error(t.plans.goals.transfer.sameGoalError);
      return;
    }
    if (parsedMinor === null) {
      toast.error(t.errors.invalidAmount);
      amountRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/goal-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_goal_id: fromGoalId,
          to_goal_id: toGoalId,
          amount_minor: parsedMinor,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      toast.success(t.plans.goals.transferCreatedToast);
      onClose();
      onSuccess();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (activeItems.length < 2) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--strata-text-secondary)]">
          {t.plans.goals.transfer.noSourceGoals}
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-xs text-[var(--strata-text-muted)]">{t.plans.goals.transfer.subtitle}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label>{t.plans.goals.transfer.fromGoalLabel}</Label>
          <Select value={fromGoalId} onValueChange={setFromGoalId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeItems.map((item) => (
                <SelectItem key={item.goal.id} value={item.goal.id}>
                  {item.goal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleSwap}
          aria-label={t.plans.goals.transfer.swapGoals}
          title={t.plans.goals.transfer.swapGoals}
          className="self-center sm:self-end"
        >
          <ArrowLeftRight
            className="h-4 w-4 transition-transform duration-300 ease-out"
            style={{ transform: `rotate(${swapRotation}deg)` }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </Button>

        <div className="min-w-0 space-y-1.5">
          <Label>{t.plans.goals.transfer.toGoalLabel}</Label>
          <Select value={toGoalId} onValueChange={setToGoalId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeItems.map((item) => (
                <SelectItem key={item.goal.id} value={item.goal.id}>
                  {item.goal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gt-amount">
          {t.plans.goals.transfer.amountLabel} ({baseCurrency})
        </Label>
        <Input
          ref={amountRef}
          id="gt-amount"
          autoFocus
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="5000"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gt-comment">{t.plans.goals.transfer.commentLabel}</Label>
        <Input
          id="gt-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t.plans.goals.transfer.commentPlaceholder}
        />
      </div>

      {exceedsSource ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] px-3 py-2 text-xs text-[var(--strata-radar-warn)]">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{t.plans.goals.transfer.exceedsBalanceWarning}</span>
        </div>
      ) : null}

      {fromItem && toItem && fromItem.goal.id !== toItem.goal.id ? (
        <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/80 p-3.5">
          <div className="text-[11px] font-medium text-[var(--strata-text-muted)]">
            {t.plans.goals.transfer.previewTitle}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                {fromItem.goal.name}
              </div>
              <div className="text-sm font-bold text-[var(--strata-text-primary)]">
                <AmountText
                  minor={Math.max(0, fromItem.envelope.currentMinor - (parsedMinor ?? 0))}
                  currency={
                    (fromItem.storageAccount
                      ? accountMap.get(fromItem.storageAccount.id)?.currency
                      : undefined) ?? baseCurrency
                  }
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                {toItem.goal.name}
              </div>
              <div className="text-sm font-bold text-[var(--strata-money-income)]">
                <AmountText
                  minor={toItem.envelope.currentMinor + (parsedMinor ?? 0)}
                  currency={
                    (toItem.storageAccount
                      ? accountMap.get(toItem.storageAccount.id)?.currency
                      : undefined) ?? baseCurrency
                  }
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
        <Button type="submit" disabled={submitting}>
          {submitting ? t.common.saving : t.plans.goals.transfer.submit}
        </Button>
      </div>
    </form>
  );
}

export function GoalTransferDialog({
  open,
  formSeq,
  onOpenChange,
  baseCurrency,
  accounts,
  activeItems,
  presetFromGoalId,
  onSuccess,
}: GoalTransferDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!submitting}
      title={t.plans.goals.transfer.title}
    >
      <GoalTransferBody
        key={`${presetFromGoalId ?? "none"}-${formSeq}`}
        baseCurrency={baseCurrency}
        accounts={accounts}
        activeItems={activeItems}
        presetFromGoalId={presetFromGoalId}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
