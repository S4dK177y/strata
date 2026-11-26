"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  AccentPalette,
  AccountType,
  CategoryKind,
  Locale,
  Profile,
  Theme,
} from "@strata/api-contract";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { AccentSwitcher } from "@/components/ui/accent-switcher";
import { AmountText } from "@/components/ui/amount-text";
import { AuroraCurtains } from "@/components/ui/aurora-curtains";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { cn, parseAmountInputToMinor, parseSignedAmountInputToMinor } from "@/lib/utils";
import {
  localizeTemplateName,
  STARTER_ACCOUNT_TEMPLATES,
  STARTER_CATEGORY_TEMPLATES,
  SUPPORTED_CURRENCIES,
} from "./starter-templates";

interface AccountDraft {
  id: string;
  templateKey: string | null;
  name: string;
  nameCustomized: boolean;
  type: AccountType;
  initialBalanceText: string;
  creditLimitText: string;
  selected: boolean;
}

interface CategoryDraft {
  id: string;
  templateKey: string | null;
  name: string;
  kind: CategoryKind;
  isPassive: boolean;
  icon: string;
  selected: boolean;
}

export function OnboardingWizard({
  initialProfile,
  email,
}: {
  initialProfile: Profile;
  email: string | null;
}) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { theme, accent } = useTheme();
  const { privacyBlur, setPrivacyBlur } = usePrivacy();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [displayName, setDisplayName] = useState(initialProfile.display_name);
  const [baseCurrency, setBaseCurrency] = useState(initialProfile.base_currency || "RUB");
  const [selectedTheme, setSelectedTheme] = useState<Theme>(initialProfile.theme || theme);
  const [selectedAccent, setSelectedAccent] = useState<AccentPalette>(
    initialProfile.accent || accent
  );
  const [privacyDefault, setPrivacyDefault] = useState(initialProfile.privacy_blur_default);

  // Step 2
  const [accounts, setAccounts] = useState<AccountDraft[]>(() =>
    STARTER_ACCOUNT_TEMPLATES.map((tpl) => ({
      id: tpl.key,
      templateKey: tpl.key,
      name: localizeTemplateName(tpl, locale),
      nameCustomized: false,
      type: tpl.type,
      initialBalanceText: tpl.initialBalanceText,
      creditLimitText: tpl.creditLimitText,
      selected: tpl.selected,
    }))
  );

  // Step 3
  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    STARTER_CATEGORY_TEMPLATES.map((tpl) => ({
      id: tpl.key,
      templateKey: tpl.key,
      name: localizeTemplateName(tpl, locale),
      kind: tpl.kind,
      isPassive: tpl.isPassive,
      icon: tpl.icon,
      selected: tpl.selected,
    }))
  );
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customCategoryKind, setCustomCategoryKind] = useState<CategoryKind>("expense");

  function handleLocaleSwitch(nextLocale: Locale) {
    setLocale(nextLocale);
    setAccounts((prev) =>
      prev.map((acc) => {
        if (!acc.templateKey || acc.nameCustomized) return acc;
        const tpl = STARTER_ACCOUNT_TEMPLATES.find((item) => item.key === acc.templateKey);
        return tpl ? { ...acc, name: localizeTemplateName(tpl, nextLocale) } : acc;
      })
    );
    setCategories((prev) =>
      prev.map((cat) => {
        if (!cat.templateKey) return cat;
        const tpl = STARTER_CATEGORY_TEMPLATES.find((item) => item.key === cat.templateKey);
        return tpl ? { ...cat, name: localizeTemplateName(tpl, nextLocale) } : cat;
      })
    );
  }

  function handleAddAccount() {
    setAccounts((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        templateKey: null,
        name: "",
        nameCustomized: true,
        type: "debit",
        initialBalanceText: "0",
        creditLimitText: "0",
        selected: true,
      },
    ]);
  }

  function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const trimmed = customCategoryName.trim();
    if (!trimmed) return;

    setCategories((prev) => [
      ...prev,
      {
        id: `custom-cat-${Date.now()}`,
        templateKey: null,
        name: trimmed,
        kind: customCategoryKind,
        isPassive: false,
        icon: "tag",
        selected: true,
      },
    ]);
    setCustomCategoryName("");
  }

  async function handleFinish(skipCategories = false) {
    setSubmitting(true);
    try {
      const selectedAccounts = accounts.filter((a) => a.selected && a.name.trim().length > 0);
      const parsedAccounts = [];
      for (const acc of selectedAccounts) {
        const balanceMinor = parseSignedAmountInputToMinor(acc.initialBalanceText);
        const limitMinor =
          acc.type === "credit" ? parseAmountInputToMinor(acc.creditLimitText) : 0;

        if (balanceMinor === null || limitMinor === null || limitMinor < 0) {
          toast.error(t.errors.invalidAmount);
          setStep(2);
          setSubmitting(false);
          return;
        }

        parsedAccounts.push({
          name: acc.name.trim(),
          type: acc.type,
          currency: baseCurrency,
          initial_balance_minor: balanceMinor,
          credit_limit_minor: limitMinor,
        });
      }

      const selectedCategories = skipCategories
        ? []
        : categories
            .filter((c) => c.selected && c.name.trim().length > 0)
            .map((c) => ({
              name: c.name.trim(),
              kind: c.kind,
              is_passive: c.isPassive,
              icon: c.icon,
            }));

      const res = await fetch("/api/v1/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          locale,
          base_currency: baseCurrency,
          theme: selectedTheme,
          accent: selectedAccent,
          privacy_blur_default: privacyDefault,
          accounts: parsedAccounts,
          categories: selectedCategories,
        }),
      });

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      toast.success(t.onboarding.successToast);
      router.push("/");
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");

  return (
    <div
      data-aurora="curtains"
      className="strata-aurora-screen flex min-h-screen flex-col"
    >
      <AuroraCurtains state={submitting ? "submitting" : "idle"} />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt={t.common.brand} className="h-9 w-9 rounded-xl shadow-sm" />
          <div>
            <span className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
              {t.common.brand}
            </span>
            {email ? (
              <span className="ml-2.5 hidden text-xs text-[var(--strata-text-secondary)] sm:inline">
                {email}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher
            onChange={handleLocaleSwitch}
            className="strata-frosted border-[var(--strata-border-subtle)]"
          />
          <ThemeSwitcher
            variant="compact"
            onChange={setSelectedTheme}
            className="strata-frosted border-[var(--strata-border-subtle)]"
          />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label={t.common.signOut}
              title={t.common.signOut}
              className="strata-frosted inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--strata-border-subtle)] px-3 py-2 text-xs font-medium text-[var(--strata-text-secondary)] transition hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">{t.common.signOut}</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8">
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--strata-text-secondary)]">
            <span>{t.onboarding.stepLabel.replace("{step}", String(step))}</span>
            <span className="strata-mono">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-200",
                  idx <= step
                    ? "bg-[var(--strata-accent-brand)]"
                    : "bg-[var(--strata-border-strong)]"
                )}
              />
            ))}
          </div>
        </div>

        <div className="strata-frosted space-y-6 rounded-[28px] p-6 sm:p-8">
          {step === 1 ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {t.onboarding.step1Title}
                </CardTitle>
                <CardDescription className="text-[var(--strata-text-secondary)]">
                  {t.onboarding.step1Subtitle}
                </CardDescription>
              </CardHeader>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="onboarding-name">{t.onboarding.displayNameLabel}</Label>
                  <Input
                    id="onboarding-name"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t.onboarding.displayNamePlaceholder}
                    className="border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/70 focus:bg-[var(--strata-bg-surface)]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t.locale.label}</Label>
                    <Select
                      value={locale}
                      onValueChange={(val) =>
                        handleLocaleSwitch(val === "en" ? "en" : "ru")
                      }
                    >
                      <SelectTrigger className="border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/70">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ru">{t.locale.ru}</SelectItem>
                        <SelectItem value="en">{t.locale.en}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.onboarding.currencyLabel}</Label>
                    <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                      <SelectTrigger className="border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/70">
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

                <div className="space-y-2">
                  <Label>{t.theme.label}</Label>
                  <ThemeSwitcher
                    variant="segmented"
                    value={selectedTheme}
                    onChange={setSelectedTheme}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.accent.label}</Label>
                  <AccentSwitcher value={selectedAccent} onChange={setSelectedAccent} />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/65 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="onboarding-privacy" className="text-sm font-semibold">
                      {t.onboarding.privacyDefaultLabel}
                    </Label>
                    <p className="text-xs text-[var(--strata-text-muted)]">
                      {t.onboarding.privacyDefaultHint}
                    </p>
                    <div className="pt-1 text-xs text-[var(--strata-text-secondary)]">
                      {t.privacy.previewLabel}:{" "}
                      <AmountText
                        minor={14500000}
                        currency={baseCurrency}
                        alwaysShowDecimals
                        className={cn(
                          "inline-block font-semibold text-[var(--strata-text-primary)] transition-[filter,opacity] duration-200",
                          (privacyDefault || privacyBlur) && "opacity-80 blur-[8px] select-none"
                        )}
                      />
                    </div>
                  </div>
                  <Switch
                    id="onboarding-privacy"
                    checked={privacyDefault}
                    onCheckedChange={(checked) => {
                      setPrivacyDefault(checked);
                      setPrivacyBlur(checked);
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} className="w-full sm:w-auto">
                  {t.common.next}
                </Button>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {t.onboarding.step2Title}
                </CardTitle>
                <CardDescription className="text-[var(--strata-text-secondary)]">
                  {t.onboarding.step2Subtitle}
                </CardDescription>
              </CardHeader>

              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={cn(
                      "space-y-3 rounded-2xl border p-4 transition",
                      acc.selected
                        ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)]/85"
                        : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/55 opacity-65"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={acc.selected}
                          aria-label={acc.name || t.onboarding.accountNameLabel}
                          onCheckedChange={(checked) =>
                            setAccounts((prev) =>
                              prev.map((item) =>
                                item.id === acc.id ? { ...item, selected: checked } : item
                              )
                            )
                          }
                        />
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--strata-text-secondary)]">
                          <CreditCard className="h-3.5 w-3.5 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                          {t.onboarding.accountTypes[acc.type]}
                        </span>
                      </div>

                      {!acc.templateKey ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t.common.remove}
                          onClick={() =>
                            setAccounts((prev) => prev.filter((item) => item.id !== acc.id))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} />
                        </Button>
                      ) : null}
                    </div>

                    {acc.selected ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label htmlFor={`acc-name-${acc.id}`}>
                            {t.onboarding.accountNameLabel}
                          </Label>
                          <Input
                            id={`acc-name-${acc.id}`}
                            value={acc.name}
                            placeholder={t.onboarding.accountNamePlaceholder}
                            onChange={(e) =>
                              setAccounts((prev) =>
                                prev.map((item) =>
                                  item.id === acc.id
                                    ? { ...item, name: e.target.value, nameCustomized: true }
                                    : item
                                )
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label>{t.onboarding.accountTypeLabel}</Label>
                          <Select
                            value={acc.type}
                            onValueChange={(val) =>
                              setAccounts((prev) =>
                                prev.map((item) =>
                                  item.id === acc.id
                                    ? { ...item, type: val as AccountType }
                                    : item
                                )
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                ["debit", "cash", "savings", "credit", "deposit"] as const
                              ).map((typeKey) => (
                                <SelectItem key={typeKey} value={typeKey}>
                                  {t.onboarding.accountTypes[typeKey]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`acc-balance-${acc.id}`}>
                            {t.onboarding.accountBalanceLabel} ({baseCurrency})
                          </Label>
                          <Input
                            id={`acc-balance-${acc.id}`}
                            inputMode="decimal"
                            value={acc.initialBalanceText}
                            onChange={(e) =>
                              setAccounts((prev) =>
                                prev.map((item) =>
                                  item.id === acc.id
                                    ? { ...item, initialBalanceText: e.target.value }
                                    : item
                                )
                              )
                            }
                          />
                        </div>

                        {acc.type === "credit" ? (
                          <div className="space-y-1 sm:col-span-3">
                            <Label htmlFor={`acc-limit-${acc.id}`}>
                              {t.onboarding.accountLimitLabel} ({baseCurrency})
                            </Label>
                            <Input
                              id={`acc-limit-${acc.id}`}
                              inputMode="decimal"
                              value={acc.creditLimitText}
                              onChange={(e) =>
                                setAccounts((prev) =>
                                  prev.map((item) =>
                                    item.id === acc.id
                                      ? { ...item, creditLimitText: e.target.value }
                                      : item
                                  )
                                )
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleAddAccount}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {t.onboarding.addAccount}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  {t.common.back}
                </Button>
                <Button onClick={() => setStep(3)}>{t.common.next}</Button>
              </div>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {t.onboarding.step3Title}
                </CardTitle>
                <CardDescription className="text-[var(--strata-text-secondary)]">
                  {t.onboarding.step3Subtitle}
                </CardDescription>
              </CardHeader>

              <div className="space-y-5">
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold tracking-wide text-[var(--strata-text-secondary)]">
                    {t.onboarding.expenseCategories}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {expenseCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setCategories((prev) =>
                            prev.map((item) =>
                              item.id === cat.id
                                ? { ...item, selected: !item.selected }
                                : item
                            )
                          )
                        }
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                          cat.selected
                            ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                            : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/55 text-[var(--strata-text-muted)]"
                        )}
                      >
                        {cat.selected ? (
                          <Check
                            className="h-3.5 w-3.5 text-[var(--strata-accent-brand)]"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold tracking-wide text-[var(--strata-text-secondary)]">
                    {t.onboarding.incomeCategories}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {incomeCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setCategories((prev) =>
                            prev.map((item) =>
                              item.id === cat.id
                                ? { ...item, selected: !item.selected }
                                : item
                            )
                          )
                        }
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                          cat.selected
                            ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)]"
                            : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/55 text-[var(--strata-text-muted)]"
                        )}
                      >
                        {cat.selected ? (
                          <Check
                            className="h-3.5 w-3.5 text-[var(--strata-accent-brand)]"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span>{cat.name}</span>
                        {cat.isPassive ? (
                          <Badge tone="passive">{t.onboarding.passiveBadge}</Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={handleAddCategory}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/65 p-3 sm:flex-row sm:items-center"
                >
                  <Input
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder={t.onboarding.customCategoryPlaceholder}
                    className="flex-1 bg-[var(--strata-bg-surface)]"
                  />
                  <Select
                    value={customCategoryKind}
                    onValueChange={(v) =>
                      setCustomCategoryKind(v === "income" ? "income" : "expense")
                    }
                  >
                    <SelectTrigger className="bg-[var(--strata-bg-surface)] sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t.onboarding.expenseCategories}</SelectItem>
                      <SelectItem value="income">{t.onboarding.incomeCategories}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="secondary">
                    <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    {t.common.add}
                  </Button>
                </form>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                  {t.common.back}
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleFinish(true)}
                    disabled={submitting}
                  >
                    {t.common.skip}
                  </Button>
                  <Button onClick={() => handleFinish(false)} disabled={submitting}>
                    {submitting ? t.onboarding.finishing : t.onboarding.finish}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
