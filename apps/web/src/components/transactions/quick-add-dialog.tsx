"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Calculator,
  ChevronDown,
  ChevronUp,
  Equal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { evaluateAmountExpression } from "@strata/finance-core";
import type {
  Account,
  Category,
  Debt,
  Goal,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@strata/api-contract";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ModalDialog } from "@/components/ui/dialog";
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
import {
  EXTENDED_TRANSACTION_TYPES,
  getCategoryIcon,
  PRIMARY_TRANSACTION_TYPES,
  TRANSACTION_TYPE_META,
} from "@/lib/category-icons";
import { useI18n } from "@/lib/i18n/client";
import {
  cn,
  localDateTimeInputToIso,
  minorToEditableInput,
  toLocalDateTimeInputValue,
} from "@/lib/utils";

export interface QuickAddPreset {
  type?: TransactionType;
  accountFromId?: string;
  categoryId?: string;
  transaction?: Transaction;
}

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  goals?: Goal[];
  debts?: Debt[];
  preset?: QuickAddPreset | null;
  onSuccess: () => void;
}

const CALC_OPERATORS = ["+", "-", "*", "/", "(", ")"] as const;

const OPERATOR_LABELS: Record<(typeof CALC_OPERATORS)[number], string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
  "(": "(",
  ")": ")",
};

function QuickAddFormBody({
  baseCurrency,
  accounts,
  categories,
  goals,
  debts,
  preset,
  submitting,
  setSubmitting,
  deleting,
  onRequestDelete,
  onClose,
  onSuccess,
}: {
  baseCurrency: string;
  accounts: Account[];
  categories: Category[];
  goals: Goal[];
  debts: Debt[];
  preset?: QuickAddPreset | null;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
  deleting: boolean;
  onRequestDelete: (tx: Transaction) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const editingTx = preset?.transaction ?? null;
  const isEditing = Boolean(editingTx);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.deleted_at && a.is_active),
    [accounts]
  );

  const selectableAccounts = useMemo(() => {
    const map = new Map<string, Account>();
    for (const acc of activeAccounts) {
      map.set(acc.id, acc);
    }
    if (editingTx) {
      for (const acc of accounts) {
        if (
          !acc.deleted_at &&
          (acc.id === editingTx.account_from_id || acc.id === editingTx.account_to_id)
        ) {
          map.set(acc.id, acc);
        }
      }
    }
    return Array.from(map.values());
  }, [activeAccounts, accounts, editingTx]);

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.deleted_at),
    [categories]
  );
  const activeGoals = useMemo(
    () => goals.filter((g) => !g.deleted_at && !g.is_archived),
    [goals]
  );
  const activeDebts = useMemo(() => debts.filter((d) => !d.deleted_at), [debts]);

  const initialType: TransactionType = editingTx?.type ?? preset?.type ?? "expense";
  const initialFrom =
    editingTx !== null
      ? editingTx.account_from_id ?? ""
      : preset?.accountFromId ?? activeAccounts[0]?.id ?? "";
  const initialTo =
    editingTx !== null
      ? editingTx.account_to_id ?? ""
      : initialType === "transfer"
        ? activeAccounts.find((a) => a.id !== initialFrom)?.id ?? activeAccounts[1]?.id ?? ""
        : "";

  const [txType, setTxType] = useState<TransactionType>(initialType);
  const [showExtendedTypes, setShowExtendedTypes] = useState(
    TRANSACTION_TYPE_META[initialType].group === "extended"
  );
  const [amountInput, setAmountInput] = useState(
    editingTx ? minorToEditableInput(editingTx.amount_minor) : ""
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [accountFromId, setAccountFromId] = useState<string>(initialFrom);
  const [accountToId, setAccountToId] = useState<string>(initialTo);
  const [categoryId, setCategoryId] = useState<string>(
    editingTx ? editingTx.category_id ?? "" : preset?.categoryId ?? ""
  );
  const [goalId, setGoalId] = useState<string>(editingTx?.goal_id ?? "");
  const [debtId, setDebtId] = useState<string>(editingTx?.debt_id ?? "");
  const [occurredAtInput, setOccurredAtInput] = useState(() =>
    editingTx
      ? toLocalDateTimeInputValue(editingTx.occurred_at)
      : toLocalDateTimeInputValue(new Date())
  );
  const [comment, setComment] = useState(editingTx?.comment ?? "");
  const [isDraft, setIsDraft] = useState(
    editingTx ? editingTx.status === "draft" : activeAccounts.length === 0
  );
  const [liveErrorAnnouncement, setLiveErrorAnnouncement] = useState("");

  const amountRef = useRef<HTMLInputElement>(null);
  const amountErrorId = useId();
  const amountHintId = useId();

  const typeMeta = TRANSACTION_TYPE_META[txType];
  const parsedMinor = useMemo(() => evaluateAmountExpression(amountInput), [amountInput]);
  const amountHasError = amountTouched && parsedMinor === null;

  const filteredCategories = useMemo(() => {
    const filterMode = typeMeta.categoryFilter;
    if (!filterMode) return [];
    if (filterMode === "expense") {
      return activeCategories.filter((c) => c.kind === "expense");
    }
    const incomeCats = activeCategories.filter((c) => c.kind === "income");
    if (filterMode === "income_passive") {
      return [...incomeCats].sort((a, b) => Number(b.is_passive) - Number(a.is_passive));
    }
    return [...incomeCats].sort((a, b) => Number(a.is_passive) - Number(b.is_passive));
  }, [activeCategories, typeMeta.categoryFilter]);

  const activeCurrency = useMemo(() => {
    const found = selectableAccounts.find((a) => a.id === accountFromId);
    return found?.currency ?? baseCurrency;
  }, [selectableAccounts, accountFromId, baseCurrency]);

  const isDebtType = txType.startsWith("debt_");

  function handleTypeChange(nextType: TransactionType) {
    setTxType(nextType);
    const nextMeta = TRANSACTION_TYPE_META[nextType];

    if (nextMeta.group === "extended") {
      setShowExtendedTypes(true);
    }

    if (nextMeta.accountDirection === "transfer") {
      if (!accountToId || accountToId === accountFromId) {
        const alt = selectableAccounts.find((a) => a.id !== accountFromId);
        setAccountToId(alt?.id ?? "");
      }
      setCategoryId("");
    } else {
      setAccountToId("");
      if (!nextMeta.categoryFilter) {
        setCategoryId("");
      } else if (categoryId) {
        const cat = activeCategories.find((c) => c.id === categoryId);
        const expectedKind = nextMeta.categoryFilter === "expense" ? "expense" : "income";
        if (cat && cat.kind !== expectedKind) {
          setCategoryId("");
        }
      }
    }
  }

  function handleAppendOperator(op: string) {
    setAmountInput((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed && (op === "(" || op === "-")) return op;
      if (!trimmed) return "";
      return `${trimmed}${op}`;
    });
    amountRef.current?.focus();
  }

  function handleEvaluateInPlace() {
    if (parsedMinor === null) {
      setAmountTouched(true);
      setLiveErrorAnnouncement(t.transactions.amountInvalid);
      amountRef.current?.focus();
      return;
    }
    setAmountInput(minorToEditableInput(parsedMinor));
    setLiveErrorAnnouncement("");
    amountRef.current?.focus();
  }

  function handleSwapAccounts() {
    const prevFrom = accountFromId;
    const prevTo = accountToId;
    setAccountFromId(prevTo);
    setAccountToId(prevFrom);
  }

  function setQuickDate(daysAgo: number) {
    const now = new Date();
    now.setDate(now.getDate() - daysAgo);
    setOccurredAtInput(toLocalDateTimeInputValue(now));
  }

  async function submitTransaction(overrideStatus?: TransactionStatus) {
    setAmountTouched(true);
    if (parsedMinor === null) {
      setLiveErrorAnnouncement(t.transactions.amountInvalid);
      amountRef.current?.focus();
      return;
    }

    const nextStatus: TransactionStatus = overrideStatus ?? (isDraft ? "draft" : "confirmed");
    const resolvedFrom = accountFromId || null;
    const resolvedTo = txType === "transfer" ? accountToId || null : null;

    if (nextStatus === "confirmed") {
      if (txType === "transfer") {
        if (!resolvedFrom || !resolvedTo) {
          toast.error(t.errors.transferAccountsRequired);
          return;
        }
        if (resolvedFrom === resolvedTo) {
          toast.error(t.errors.sameTransferAccounts);
          return;
        }
      } else if (!resolvedFrom) {
        toast.error(t.errors.accountRequired);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        occurred_at: localDateTimeInputToIso(occurredAtInput),
        type: txType,
        amount_minor: parsedMinor,
        category_id: typeMeta.categoryFilter ? categoryId || null : null,
        account_from_id: resolvedFrom,
        account_to_id: resolvedTo,
        goal_id: goalId || null,
        debt_id: debtId || null,
        comment: comment.trim(),
        status: nextStatus,
        ...(isEditing ? {} : { source: "web" as const }),
      };

      const res = await fetch(
        isEditing && editingTx
          ? `/api/v1/transactions/${editingTx.id}`
          : "/api/v1/transactions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(err?.message ?? t.errors.generic);
        return;
      }

      if (isEditing) {
        toast.success(
          overrideStatus === "confirmed"
            ? t.transactions.confirmedToast
            : t.transactions.updatedToast
        );
      } else {
        toast.success(t.transactions.createdToast);
      }

      onClose();
      onSuccess();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submitTransaction();
  }

  const describedByIds = [amountHintId, amountHasError ? amountErrorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div aria-live="polite" className="visually-hidden">
        {liveErrorAnnouncement}
      </div>

      <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--strata-bg-elevated)] p-1">
            {PRIMARY_TRANSACTION_TYPES.map((key) => {
              const Icon = TRANSACTION_TYPE_META[key].icon;
              const active = txType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChange(key)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition",
                    active
                      ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-sm"
                      : "text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span className="truncate">{t.transactions.types[key]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowExtendedTypes((v) => !v)}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-[var(--strata-text-secondary)] transition hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
            >
              {showExtendedTypes ? (
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              )}
              {showExtendedTypes ? t.transactions.hideMoreTypes : t.transactions.moreTypes}
            </button>

            {typeMeta.group === "extended" ? (
              <Badge tone="brand">{t.transactions.types[txType]}</Badge>
            ) : null}
          </div>

          {showExtendedTypes ? (
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/65 p-2 sm:grid-cols-4">
              {EXTENDED_TRANSACTION_TYPES.map((key) => {
                const Icon = TRANSACTION_TYPE_META[key].icon;
                const active = txType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTypeChange(key)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium transition",
                      active
                        ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                        : "border-transparent text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-surface)]/70"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">{t.transactions.types[key]}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="text-xs leading-relaxed text-[var(--strata-text-muted)]">
            {t.transactions.typeDescriptions[txType]}
          </p>
        </div>

        <div className="space-y-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/70 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="qa-amount" className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              {t.transactions.amountLabel} ({activeCurrency})
            </Label>

            <div id={amountHintId} className="text-xs font-semibold">
              {parsedMinor !== null ? (
                <span style={{ color: typeMeta.colorVar }}>
                  {t.transactions.amountPreview}:{" "}
                  <AmountText
                    minor={parsedMinor}
                    currency={activeCurrency}
                    mutedFraction={false}
                  />
                </span>
              ) : (
                <span className="text-[var(--strata-text-muted)]">
                  {t.transactions.amountPlaceholder}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              ref={amountRef}
              id="qa-amount"
              autoFocus
              inputMode="decimal"
              value={amountInput}
              aria-invalid={amountHasError ? "true" : "false"}
              aria-describedby={describedByIds || undefined}
              onChange={(e) => {
                const next = e.target.value;
                setAmountInput(next);
                if (amountTouched && evaluateAmountExpression(next) !== null) {
                  setLiveErrorAnnouncement("");
                }
              }}
              onBlur={() => {
                setAmountTouched(true);
                if (evaluateAmountExpression(amountInput) === null) {
                  setLiveErrorAnnouncement(t.transactions.amountInvalid);
                }
              }}
              placeholder={t.transactions.amountPlaceholder}
              className={cn(
                "strata-mono bg-[var(--strata-bg-surface)] text-lg font-bold",
                amountHasError && "border-[var(--strata-money-expense)]"
              )}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleEvaluateInPlace}
              aria-label={t.transactions.evalEquals}
              title={t.transactions.evalEquals}
            >
              <Equal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CALC_OPERATORS.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => handleAppendOperator(op)}
                className="strata-mono flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-xl bg-[var(--strata-bg-surface)] px-2.5 text-sm font-semibold text-[var(--strata-text-secondary)] transition hover:text-[var(--strata-text-primary)]"
              >
                {OPERATOR_LABELS[op]}
              </button>
            ))}
          </div>

          {amountHasError ? (
            <p id={amountErrorId} className="text-xs font-medium text-[var(--strata-money-expense)]">
              {t.transactions.amountInvalid}
            </p>
          ) : null}
        </div>

        {selectableAccounts.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-3 text-xs text-[var(--strata-text-secondary)]">
            <span>{t.transactions.noAccountsHint}</span>
            <Link
              href="/capital"
              onClick={onClose}
              className="font-semibold text-[var(--strata-accent-brand)] hover:underline"
            >
              {t.transactions.openCapital}
            </Link>
          </div>
        ) : typeMeta.accountDirection === "transfer" ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-1.5">
              <Label>{t.transactions.accountFromLabel}</Label>
              <Select
                value={accountFromId || "__none__"}
                onValueChange={(val) => setAccountFromId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.transactions.selectAccount} />
                </SelectTrigger>
                <SelectContent>
                  {isDraft ? (
                    <SelectItem value="__none__">{t.transactions.noAccountOption}</SelectItem>
                  ) : null}
                  {selectableAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSwapAccounts}
              aria-label={t.transactions.swapAccounts}
              title={t.transactions.swapAccounts}
              className="self-center sm:self-end"
            >
              <ArrowUpDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>

            <div className="space-y-1.5">
              <Label>{t.transactions.accountToLabel}</Label>
              <Select
                value={accountToId || "__none__"}
                onValueChange={(val) => setAccountToId(val === "__none__" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.transactions.selectAccount} />
                </SelectTrigger>
                <SelectContent>
                  {isDraft ? (
                    <SelectItem value="__none__">{t.transactions.noAccountOption}</SelectItem>
                  ) : null}
                  {selectableAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>
              {typeMeta.accountDirection === "in"
                ? t.transactions.accountTargetLabel
                : t.transactions.accountFromLabel}
            </Label>
            <Select
              value={accountFromId || "__none__"}
              onValueChange={(val) => setAccountFromId(val === "__none__" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.transactions.selectAccount} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.transactions.noAccountOption}</SelectItem>
                {selectableAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {typeMeta.categoryFilter ? (
          <div className="space-y-2">
            <Label>{t.transactions.categoryLabel}</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryId("")}
                aria-pressed={categoryId === ""}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  categoryId === ""
                    ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                    : "border-[var(--strata-border-subtle)] text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                {t.transactions.noCategory}
              </button>
              {filteredCategories.map((cat) => {
                const Icon = getCategoryIcon(cat.icon);
                const selected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(selected ? "" : cat.id)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      selected
                        ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                        : "border-[var(--strata-border-subtle)] text-[var(--strata-text-secondary)] hover:border-[var(--strata-border-strong)]"
                    )}
                  >
                    <Icon
                      className="h-3.5 w-3.5 text-[var(--strata-text-muted)]"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="qa-date">{t.transactions.dateLabel}</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-medium text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)]"
                >
                  {t.transactions.today}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-medium text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)]"
                >
                  {t.transactions.yesterday}
                </button>
              </div>
            </div>
            <Input
              id="qa-date"
              type="datetime-local"
              value={occurredAtInput}
              onChange={(e) => setOccurredAtInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qa-comment">{t.transactions.commentLabel}</Label>
            <Input
              id="qa-comment"
              type="text"
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isDebtType
                  ? t.transactions.commentDebtPlaceholder
                  : t.transactions.commentPlaceholder
              }
            />
          </div>
        </div>

        {activeGoals.length > 0 || activeDebts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activeGoals.length > 0 ? (
              <div className="space-y-1.5">
                <Label>{t.transactions.goalLabel}</Label>
                <Select
                  value={goalId || "__none__"}
                  onValueChange={(val) => setGoalId(val === "__none__" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.transactions.noneOption}</SelectItem>
                    {activeGoals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {activeDebts.length > 0 && isDebtType ? (
              <div className="space-y-1.5">
                <Label>{t.transactions.debtLabel}</Label>
                <Select
                  value={debtId || "__none__"}
                  onValueChange={(val) => setDebtId(val === "__none__" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.transactions.noneOption}</SelectItem>
                    {activeDebts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.counterparty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="qa-draft" className="text-sm font-semibold">
              {t.transactions.draftToggleLabel}
            </Label>
            <p className="text-xs text-[var(--strata-text-muted)]">
              {t.transactions.draftToggleHint}
            </p>
          </div>
          <Switch id="qa-draft" checked={isDraft} onCheckedChange={setIsDraft} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          {isEditing && editingTx ? (
            <Button
              type="button"
              variant="outline"
              disabled={submitting || deleting}
              onClick={() => onRequestDelete(editingTx)}
              className="text-[var(--strata-money-expense)] hover:text-[var(--strata-money-expense)]"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.common.delete}
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isEditing && editingTx?.status === "draft" && isDraft ? (
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => void submitTransaction("confirmed")}
              >
                {t.transactions.confirmAndSave}
              </Button>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting
                ? t.common.saving
                : isEditing
                  ? t.transactions.saveChanges
                  : t.transactions.saveOperation}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

export function QuickAddDialog({
  open,
  onOpenChange,
  baseCurrency,
  accounts,
  categories,
  goals = [],
  debts = [],
  preset,
  onSuccess,
}: QuickAddDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/transactions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.transactions.deletedToast);
      setDeleteTarget(null);
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeleting(false);
    }
  }

  const formKey = preset?.transaction?.id ?? `${preset?.type ?? "expense"}-${preset?.accountFromId ?? ""}`;

  return (
    <>
      <ModalDialog
        open={open}
        onOpenChange={onOpenChange}
        title={preset?.transaction ? t.transactions.editTitle : t.transactions.quickAddTitle}
        dismissible={!submitting && !deleting}
      >
        <QuickAddFormBody
          key={formKey}
          baseCurrency={baseCurrency}
          accounts={accounts}
          categories={categories}
          goals={goals}
          debts={debts}
          preset={preset}
          submitting={submitting}
          setSubmitting={setSubmitting}
          deleting={deleting}
          onRequestDelete={setDeleteTarget}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        title={t.transactions.deleteConfirmTitle}
        description={t.transactions.deleteConfirmBody}
        confirmLabel={t.common.delete}
        busy={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
