"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Calculator,
  Calendar,
  ChevronDown,
  Equal,
  Handshake,
  Pencil,
  Repeat,
  Tag,
  Target,
  Trash2,
  Wallet,
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
  amountMinor?: number;
  comment?: string;
  recurringPaymentId?: string;
  recurringPaymentName?: string;
  transaction?: Transaction;
}

interface QuickAddDialogProps {
  open: boolean;
  openSeq?: number;
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
  const [showCalc, setShowCalc] = useState(false);
  const [swapRotation, setSwapRotation] = useState(0);
  const [amountInput, setAmountInput] = useState(
    editingTx
      ? minorToEditableInput(editingTx.amount_minor)
      : preset?.amountMinor
        ? minorToEditableInput(preset.amountMinor)
        : ""
  );
  const [amountTouched, setAmountTouched] = useState(false);
  const [accountFromId, setAccountFromId] = useState<string>(initialFrom);
  const [accountToId, setAccountToId] = useState<string>(initialTo);
  const [categoryId, setCategoryId] = useState<string>(
    editingTx ? editingTx.category_id ?? "" : preset?.categoryId ?? ""
  );
  const [goalId, setGoalId] = useState<string>(editingTx?.goal_id ?? "");
  const [debtId, setDebtId] = useState<string>(editingTx?.debt_id ?? "");
  const recurringPaymentId = editingTx?.recurring_payment_id ?? preset?.recurringPaymentId ?? null;
  const [occurredAtInput, setOccurredAtInput] = useState(() =>
    editingTx
      ? toLocalDateTimeInputValue(editingTx.occurred_at)
      : toLocalDateTimeInputValue(new Date())
  );
  const [comment, setComment] = useState(editingTx?.comment ?? preset?.comment ?? "");
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
  const hasMathOperator = useMemo(
    () => /[+\-*/()]/.test(amountInput.replace(/^\s*-/, "")),
    [amountInput]
  );

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

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return t.transactions.noCategory;
    return activeCategories.find((c) => c.id === categoryId)?.name ?? t.transactions.noCategory;
  }, [activeCategories, categoryId, t.transactions.noCategory]);

  const todayPrefix = useMemo(() => toLocalDateTimeInputValue(new Date()).slice(0, 10), []);
  const yesterdayPrefix = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDateTimeInputValue(d).slice(0, 10);
  }, []);
  const currentDatePrefix = occurredAtInput.slice(0, 10);

  const isDebtType = txType.startsWith("debt_");
  const primaryIndex = (PRIMARY_TRANSACTION_TYPES as readonly TransactionType[]).indexOf(txType);

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
    setSwapRotation((r) => r + 180);
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
        recurring_payment_id: recurringPaymentId,
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
        {/* Top Type Switcher + Centered Receipt Amount (with smooth ambient tint) */}
        <div
          className="space-y-3 rounded-2xl border border-[var(--strata-border-subtle)] p-3.5 transition-[background] duration-300"
          style={{
            background: `radial-gradient(90% 65% at 50% 0%, color-mix(in srgb, ${typeMeta.colorVar} 12%, transparent) 0%, transparent 72%), color-mix(in srgb, var(--strata-bg-elevated) 55%, transparent)`,
          }}
        >
          <div className="flex items-stretch gap-1.5">
            <div className="relative grid flex-1 grid-cols-3 rounded-xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]/85 p-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-[var(--strata-bg-elevated)] shadow-sm transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translateX(${Math.max(0, primaryIndex) * 100}%)`,
                  opacity: primaryIndex >= 0 ? 1 : 0,
                }}
              />
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
                      "relative z-10 flex min-h-9 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-200",
                      active
                        ? "text-[var(--strata-text-primary)]"
                        : "text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">{t.transactions.types[key]}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowExtendedTypes((v) => !v)}
              aria-expanded={showExtendedTypes}
              aria-label={
                showExtendedTypes ? t.transactions.hideMoreTypes : t.transactions.moreTypes
              }
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1 self-stretch rounded-xl border px-2.5 text-xs font-semibold transition-colors duration-200",
                typeMeta.group === "extended" || showExtendedTypes
                  ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                  : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]/85 text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
              )}
            >
              <span>{t.transactions.moreShort}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  showExtendedTypes && "rotate-180"
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
          </div>

          <div
            className="strata-collapsible"
            data-open={showExtendedTypes ? "true" : "false"}
            aria-hidden={!showExtendedTypes}
          >
            <div className="space-y-2 pt-0.5">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {EXTENDED_TRANSACTION_TYPES.map((key) => {
                  const Icon = TRANSACTION_TYPE_META[key].icon;
                  const active = txType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      tabIndex={showExtendedTypes ? 0 : -1}
                      onClick={() => handleTypeChange(key)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors duration-150",
                        active
                          ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                          : "border-transparent bg-[var(--strata-bg-surface)]/45 text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-surface)]/80"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">{t.transactions.types[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {showExtendedTypes || typeMeta.group === "extended" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--strata-text-muted)]">
              <span className="min-w-0 flex-1">{t.transactions.typeDescriptions[txType]}</span>
              {typeMeta.group === "extended" ? (
                <Badge tone="brand">{t.transactions.types[txType]}</Badge>
              ) : null}
            </div>
          ) : null}

          {preset?.recurringPaymentName ? (
            <div className="flex items-center justify-center">
              <Badge tone="brand">
                <Repeat className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{preset.recurringPaymentName}</span>
              </Badge>
            </div>
          ) : null}

          {/* Centered Hero Amount */}
          <div className="space-y-2 py-1 text-center">
            <Label htmlFor="qa-amount" className="visually-hidden">
              {t.transactions.amountLabel} ({activeCurrency})
            </Label>

            <div className="group space-y-2">
              <div className="flex items-center justify-center gap-2 px-2">
                {txType === "transfer" ? (
                  <ArrowLeftRight
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 transition-colors duration-200 sm:h-7 sm:w-7"
                    style={{ color: typeMeta.colorVar }}
                    strokeWidth={2.2}
                  />
                ) : typeMeta.sign ? (
                  <span
                    aria-hidden="true"
                    className="text-2xl font-bold transition-colors duration-200 sm:text-3xl"
                    style={{ color: typeMeta.colorVar }}
                  >
                    {typeMeta.sign}
                  </span>
                ) : null}
                <input
                  ref={amountRef}
                  id="qa-amount"
                  autoFocus
                  inputMode="decimal"
                  value={amountInput}
                  aria-invalid={amountHasError ? "true" : "false"}
                  aria-describedby={describedByIds || undefined}
                  onChange={(e) => {
                    const next = e.target.value
                      .replace(/×/g, "*")
                      .replace(/÷/g, "/")
                      .replace(/[−–—]/g, "-")
                      .replace(/[^0-9.,+\-*/()=\s]/g, "");
                    setAmountInput(next);
                    if (/[+*/()]/.test(next)) {
                      setShowCalc(true);
                    }
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
                  placeholder="0"
                  style={{
                    color: amountInput ? typeMeta.colorVar : "var(--strata-text-primary)",
                  }}
                  className="strata-mono strata-plain-input w-full max-w-[230px] min-w-0 bg-transparent text-center text-3xl font-extrabold tracking-tight placeholder:text-[var(--strata-text-muted)]/55 focus:outline-none sm:text-4xl"
                />
                <span className="strata-mono shrink-0 text-sm font-bold text-[var(--strata-text-muted)]">
                  {activeCurrency}
                </span>
              </div>

              <div
                className={cn(
                  "mx-auto h-px w-44 transition-[width,background-color] duration-200",
                  amountHasError
                    ? "bg-[var(--strata-money-expense)]"
                    : "bg-[var(--strata-border-strong)] group-focus-within:w-52 group-focus-within:bg-[var(--strata-accent-brand)]"
                )}
              />
            </div>

            <div id={amountHintId} className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowCalc((v) => !v);
                  amountRef.current?.focus();
                }}
                aria-expanded={showCalc}
                data-qa-calc-toggle
                className={cn(
                  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                  showCalc
                    ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                    : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)]/75 text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {parsedMinor !== null && hasMathOperator ? (
                  <span style={{ color: typeMeta.colorVar }} className="font-semibold">
                    = <AmountText minor={parsedMinor} currency={activeCurrency} mutedFraction={false} />
                  </span>
                ) : (
                  <span>{t.transactions.calculatorToggle}</span>
                )}
              </button>

              {parsedMinor !== null && hasMathOperator ? (
                <button
                  type="button"
                  onClick={handleEvaluateInPlace}
                  aria-label={t.transactions.evalEquals}
                  title={t.transactions.evalEquals}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] transition hover:border-[var(--strata-border-strong)]"
                >
                  <Equal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div
              className="strata-collapsible"
              data-open={showCalc ? "true" : "false"}
              data-qa-calc-drawer
              aria-hidden={!showCalc}
            >
              <div className="flex items-center gap-1 pt-1">
                {CALC_OPERATORS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    tabIndex={showCalc ? 0 : -1}
                    onClick={() => handleAppendOperator(op)}
                    className="strata-mono flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-sm font-semibold text-[var(--strata-text-secondary)] transition hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
                  >
                    {OPERATOR_LABELS[op]}
                  </button>
                ))}
                <button
                  type="button"
                  tabIndex={showCalc ? 0 : -1}
                  onClick={handleEvaluateInPlace}
                  aria-label={t.transactions.evalEquals}
                  title={t.transactions.evalEquals}
                  className="flex h-9 flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] transition hover:brightness-110"
                >
                  <Equal className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>

            {amountHasError ? (
              <p id={amountErrorId} className="text-xs font-medium text-[var(--strata-money-expense)]">
                {t.transactions.amountInvalid}
              </p>
            ) : null}
          </div>
        </div>

        {/* Grouped Banking Receipt Card */}
        <div className="divide-y divide-[var(--strata-border-subtle)] rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/65">
          {/* Account / Transfer Route Row */}
          {selectableAccounts.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-xs text-[var(--strata-text-secondary)]">
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
            <div className="grid grid-cols-1 gap-2 px-3.5 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div className="space-y-1">
                <Label className="text-[11px]">{t.transactions.accountFromLabel}</Label>
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
                <ArrowLeftRight
                  className="h-4 w-4 transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${swapRotation}deg)` }}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </Button>

              <div className="space-y-1">
                <Label className="text-[11px]">{t.transactions.accountToLabel}</Label>
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
            <div className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
                <Wallet className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                {typeMeta.accountDirection === "in"
                  ? t.transactions.accountTargetLabel
                  : t.transactions.accountFromLabel}
              </Label>
              <div className="w-full sm:w-56">
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
            </div>
          )}

          {/* Category Wrapped Scrollable Pills Row */}
          {typeMeta.categoryFilter ? (
            <div className="space-y-2 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
                  <Tag className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                  {t.transactions.categoryLabel}
                </span>
                <span className="truncate text-xs font-semibold text-[var(--strata-text-primary)]">
                  {selectedCategoryName}
                </span>
              </div>

              <div className="strata-scroll flex max-h-36 flex-wrap items-center gap-1.5 overflow-y-auto pr-0.5">
                <button
                  type="button"
                  onClick={() => setCategoryId("")}
                  aria-pressed={categoryId === ""}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                    categoryId === ""
                      ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
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
                        "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                        selected
                          ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
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

          {/* Date & Quick Day Chips Row */}
          <div className="space-y-2 px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="qa-date"
                className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]"
              >
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                {t.transactions.dateLabel}
              </Label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150",
                    currentDatePrefix === todayPrefix
                      ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                      : "border-[var(--strata-border-subtle)] text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  {t.transactions.today}
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-150",
                    currentDatePrefix === yesterdayPrefix
                      ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                      : "border-[var(--strata-border-subtle)] text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
                  )}
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
              className="h-10 min-w-0 max-w-full bg-[var(--strata-bg-surface)]"
            />
          </div>

          {/* Comment Row */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Label htmlFor="qa-comment" className="visually-hidden">
              {t.transactions.commentLabel}
            </Label>
            <Pencil
              className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
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
              className="strata-plain-input h-9 w-full min-w-0 bg-transparent text-sm text-[var(--strata-text-primary)] placeholder:text-[var(--strata-text-muted)] focus:outline-none"
            />
          </div>

          {/* Optional Goal & Debt Rows */}
          {activeGoals.length > 0 ? (
            <div className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
                <Target className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                {t.transactions.goalLabel}
              </Label>
              <div className="w-full sm:w-56">
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
            </div>
          ) : null}

          {activeDebts.length > 0 && isDebtType ? (
            <div className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
                <Handshake className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                {t.transactions.debtLabel}
              </Label>
              <div className="w-full sm:w-56">
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
            </div>
          ) : null}
        </div>

        {/* Receipt Footer Bar */}
        <div className="flex flex-col gap-3 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div
              className="flex items-center gap-2.5"
              title={t.transactions.draftToggleHint}
            >
              <Switch id="qa-draft" checked={isDraft} onCheckedChange={setIsDraft} />
              <Label htmlFor="qa-draft" className="cursor-pointer text-xs font-semibold">
                {t.transactions.draftBadge}
              </Label>
            </div>

            {isEditing && editingTx ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || deleting}
                onClick={() => onRequestDelete(editingTx)}
                className="text-[var(--strata-money-expense)] hover:text-[var(--strata-money-expense)]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t.common.delete}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isEditing && editingTx?.status === "draft" && isDraft ? (
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => void submitTransaction("confirmed")}
                className="w-full sm:w-auto"
              >
                {t.transactions.confirmAndSave}
              </Button>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
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
  openSeq = 0,
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

  const formKey = `${preset?.transaction?.id ?? preset?.type ?? "expense"}-${preset?.accountFromId ?? ""}-${openSeq}`;

  return (
    <>
      <ModalDialog
        open={open}
        onOpenChange={onOpenChange}
        title={preset?.transaction ? t.transactions.editTitle : t.transactions.quickAddTitle}
        dismissible={!submitting && !deleting}
        maxWidthClassName="sm:max-w-[560px]"
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
