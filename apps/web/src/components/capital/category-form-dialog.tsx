"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Category, CategoryKind } from "@strata/api-contract";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_ICON_LIST } from "@/lib/category-icons";
import { useI18n } from "@/lib/i18n/client";
import { cn, minorToEditableInput, parseAmountInputToMinor } from "@/lib/utils";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseCurrency: string;
  category?: Category | null;
  defaultKind?: CategoryKind;
  onSuccess: () => void;
}

function CategoryFormBody({
  baseCurrency,
  category,
  defaultKind,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  baseCurrency: string;
  category?: Category | null;
  defaultKind: CategoryKind;
  onClose: () => void;
  onSuccess: () => void;
  submitting: boolean;
  setSubmitting: (val: boolean) => void;
}) {
  const { t } = useI18n();
  const isEditing = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind);
  const [isPassive, setIsPassive] = useState(category?.is_passive ?? false);
  const [limitInput, setLimitInput] = useState(
    category && category.monthly_limit_minor !== null
      ? minorToEditableInput(category.monthly_limit_minor)
      : ""
  );
  const [iconKey, setIconKey] = useState<string>(
    category?.icon ?? (defaultKind === "income" ? "wallet" : "shopping-cart")
  );
  const [hint, setHint] = useState(category?.hint ?? "");

  const nameRef = useRef<HTMLInputElement>(null);
  const nameErrorId = useId();

  const parsedLimitMinor = useMemo(() => {
    if (!limitInput.trim()) return null;
    return parseAmountInputToMinor(limitInput);
  }, [limitInput]);

  const nameInvalid = nameTouched && name.trim().length === 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameTouched(true);

    if (name.trim().length === 0) {
      nameRef.current?.focus();
      return;
    }

    if (kind === "expense" && limitInput.trim() && (parsedLimitMinor === null || parsedLimitMinor < 0)) {
      toast.error(t.errors.invalidAmount);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        kind,
        is_passive: kind === "income" ? isPassive : false,
        monthly_limit_minor: kind === "expense" ? parsedLimitMinor : null,
        icon: iconKey,
        hint: hint.trim() || null,
      };

      const res = await fetch(
        isEditing && category
          ? `/api/v1/categories/${category.id}`
          : "/api/v1/categories",
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
        isEditing ? t.capital.categoryUpdatedToast : t.capital.categoryCreatedToast
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
        <Label>{t.capital.categoryKindLabel}</Label>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--strata-bg-elevated)] p-1">
          {(
            [
              { key: "expense", label: t.capital.kindExpense },
              { key: "income", label: t.capital.kindIncome },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={kind === opt.key}
              onClick={() => {
                setKind(opt.key);
                if (opt.key === "expense") setIsPassive(false);
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-xl text-xs font-semibold transition",
                kind === opt.key
                  ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-sm"
                  : "text-[var(--strata-text-secondary)] hover:text-[var(--strata-text-primary)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cat-form-name">{t.capital.categoryNameLabel}</Label>
        <Input
          ref={nameRef}
          id="cat-form-name"
          autoFocus
          value={name}
          aria-invalid={nameInvalid ? "true" : "false"}
          aria-describedby={nameInvalid ? nameErrorId : undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder={t.capital.categoryNamePlaceholder}
          className={cn(nameInvalid && "border-[var(--strata-money-expense)]")}
        />
        {nameInvalid ? (
          <p id={nameErrorId} className="text-xs text-[var(--strata-money-expense)]">
            {t.errors.nameRequired}
          </p>
        ) : null}
      </div>

      {kind === "expense" ? (
        <div className="space-y-1.5">
          <Label htmlFor="cat-form-limit">
            {t.capital.monthlyLimitLabel} ({baseCurrency})
          </Label>
          <Input
            id="cat-form-limit"
            inputMode="decimal"
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            placeholder={t.capital.monthlyLimitPlaceholder}
            className="strata-mono"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="cat-form-passive" className="text-sm font-semibold">
              {t.capital.passiveSwitchLabel}
            </Label>
            <p className="text-xs text-[var(--strata-text-muted)]">
              {t.capital.passiveSwitchHint}
            </p>
          </div>
          <Switch
            id="cat-form-passive"
            checked={isPassive}
            onCheckedChange={setIsPassive}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cat-form-hint">{t.capital.hintLabel}</Label>
        <Input
          id="cat-form-hint"
          value={hint}
          maxLength={240}
          onChange={(e) => setHint(e.target.value)}
          placeholder={t.capital.hintPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label>{t.capital.iconLabel}</Label>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {CATEGORY_ICON_LIST.map(({ key, icon: Icon }) => {
            const active = iconKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIconKey(key)}
                aria-label={key}
                aria-pressed={active}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center rounded-2xl border transition",
                  active
                    ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                    : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-muted)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            );
          })}
        </div>
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

export function CategoryFormDialog({
  open,
  onOpenChange,
  baseCurrency,
  category,
  defaultKind = "expense",
  onSuccess,
}: CategoryFormDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t.capital.editCategory : t.capital.addCategory}
      dismissible={!submitting}
    >
      <CategoryFormBody
        key={category?.id ?? `new-${defaultKind}`}
        baseCurrency={baseCurrency}
        category={category}
        defaultKind={defaultKind}
        onClose={() => onOpenChange(false)}
        onSuccess={onSuccess}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </ModalDialog>
  );
}
