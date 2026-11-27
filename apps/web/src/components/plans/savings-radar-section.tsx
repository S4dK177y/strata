"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Percent,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import type { PromoRadarStatus, SavingsPortfolioSummary } from "@strata/finance-core";
import type { Account, SavingsRule } from "@strata/api-contract";
import { useQuickAdd } from "@/components/transactions/quick-add-provider";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCOUNT_TYPE_ICONS } from "@/lib/category-icons";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface SavingsRadarSectionProps {
  baseCurrency: string;
  accounts: Account[];
  savingsRules: SavingsRule[];
  balances: Record<string, number>;
  summary: SavingsPortfolioSummary;
  promoWarningDays: number;
  onWarningDaysChange: (days: number) => void;
  onOpenRuleForm: (rule: SavingsRule | null, presetAccountId?: string | null) => void;
  onRefresh: () => Promise<void>;
}

const WARNING_DAY_OPTIONS = [7, 14, 30] as const;

function getRadarBadgeTone(
  status: PromoRadarStatus
): "default" | "ok" | "warn" | "danger" {
  switch (status) {
    case "active":
      return "ok";
    case "expiring_soon":
      return "warn";
    case "expired":
      return "danger";
    default:
      return "default";
  }
}

export function SavingsRadarSection({
  baseCurrency,
  accounts,
  savingsRules,
  balances,
  summary,
  promoWarningDays,
  onWarningDaysChange,
  onOpenRuleForm,
  onRefresh,
}: SavingsRadarSectionProps) {
  const { locale, t } = useI18n();
  const { openQuickAdd } = useQuickAdd();

  const [deletingRule, setDeletingRule] = useState<SavingsRule | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [savingWindow, setSavingWindow] = useState(false);

  const apiRuleMap = useMemo(
    () => new Map(savingsRules.map((r) => [r.id, r])),
    [savingsRules]
  );

  const untrackedSavingsAccounts = useMemo(() => {
    const trackedIds = new Set(savingsRules.map((r) => r.account_id));
    return accounts.filter(
      (a) =>
        a.is_active &&
        !a.deleted_at &&
        (a.type === "savings" || a.type === "deposit") &&
        !trackedIds.has(a.id)
    );
  }, [accounts, savingsRules]);

  const hasEligibleAccounts = useMemo(
    () =>
      accounts.some(
        (a) =>
          a.is_active &&
          !a.deleted_at &&
          (a.type === "savings" || a.type === "deposit" || a.type === "debit")
      ),
    [accounts]
  );

  function formatRate(decimalRate: number): string {
    const pct = Math.round(decimalRate * 1000) / 10;
    return `${new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      maximumFractionDigits: 2,
    }).format(pct)}%`;
  }

  function formatShortDate(isoDate: string): string {
    const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
    }).format(parsed);
  }

  async function handleWarningWindowChange(days: number) {
    if (days === promoWarningDays || savingWindow) return;
    const prev = promoWarningDays;
    onWarningDaysChange(days);
    setSavingWindow(true);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrapped_settings: { promoWarningDays: days } }),
      });
      if (!res.ok) {
        onWarningDaysChange(prev);
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.savings.windowSavedToast);
    } catch {
      onWarningDaysChange(prev);
      toast.error(t.errors.generic);
    } finally {
      setSavingWindow(false);
    }
  }

  async function handleDeleteRule() {
    if (!deletingRule) return;
    setDeletingBusy(true);
    try {
      const res = await fetch(`/api/v1/savings-rules/${deletingRule.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      toast.success(t.plans.savings.deletedToast);
      setDeletingRule(null);
      await onRefresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Unified Savings Portfolio Summary Card */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium text-[var(--strata-text-muted)]">
              {t.plans.savings.monthlyForecast}
            </div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-[var(--strata-money-income)] sm:text-[28px]">
              <AmountText
                minor={summary.totalMonthlyInterestMinor}
                currency={baseCurrency}
                showSign
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-[var(--strata-text-muted)]">
              {t.plans.savings.warningWindow}:
            </span>
            <div className="inline-flex rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] p-0.5">
              {WARNING_DAY_OPTIONS.map((days) => {
                const active = promoWarningDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    disabled={savingWindow}
                    onClick={() => void handleWarningWindowChange(days)}
                    className={cn(
                      "min-h-7 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold transition",
                      active
                        ? "bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] shadow-xs"
                        : "text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                    )}
                  >
                    {t.plans.savings.warningDays.replace("{days}", String(days))}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--strata-border-subtle)] pt-3.5 sm:gap-4">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.savings.annualForecast}
            </div>
            <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-money-income)] sm:text-sm">
              <AmountText
                minor={summary.totalAnnualInterestMinor}
                currency={baseCurrency}
                showSign
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.savings.weightedRate}
            </div>
            <div className="strata-money mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
              {formatRate(summary.weightedEffectiveRate)}
            </div>
          </div>

          <div className="min-w-0">
            <div className="truncate text-[11px] text-[var(--strata-text-muted)] sm:text-xs">
              {t.plans.savings.trackedBalance}
            </div>
            <div className="mt-0.5 truncate text-xs font-bold text-[var(--strata-text-primary)] sm:text-sm">
              <AmountText minor={summary.totalTrackedBalanceMinor} currency={baseCurrency} />
            </div>
          </div>
        </div>

        {summary.alertCount > 0 ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)]/80 px-3.5 py-2.5 text-xs"
          >
            <AlertTriangle
              className="h-4 w-4 shrink-0"
              style={{
                color:
                  summary.expiredCount > 0
                    ? "var(--strata-radar-expired)"
                    : "var(--strata-radar-warn)",
              }}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--strata-text-primary)]">
              {t.plans.savings.radarAlertSummary.replace(
                "{count}",
                String(summary.alertCount)
              )}
            </span>
            <span className="text-[var(--strata-text-muted)]">
              {summary.expiringSoonCount > 0
                ? t.plans.savings.radarAlertExpiring.replace(
                    "{count}",
                    String(summary.expiringSoonCount)
                  )
                : ""}
              {summary.expiringSoonCount > 0 && summary.expiredCount > 0 ? " · " : ""}
              {summary.expiredCount > 0
                ? t.plans.savings.radarAlertExpired.replace(
                    "{count}",
                    String(summary.expiredCount)
                  )
                : ""}
            </span>
          </div>
        ) : null}
      </Card>

      {/* Tracked Savings Rule Cards */}
      {summary.items.length === 0 ? (
        <Card className="space-y-3 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--strata-bg-elevated)] text-[var(--strata-text-muted)]">
            <PiggyBank className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[var(--strata-text-primary)]">
              {t.plans.savings.emptyTitle}
            </h2>
            <p className="mx-auto max-w-md text-xs text-[var(--strata-text-muted)] sm:text-sm">
              {hasEligibleAccounts
                ? t.plans.savings.emptyBody
                : t.plans.savings.noEligibleAccounts}
            </p>
          </div>
          {hasEligibleAccounts ? (
            <div className="pt-1">
              <Button type="button" onClick={() => onOpenRuleForm(null, null)}>
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {t.plans.actions.addRule}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            summary.items.length > 1 && "md:grid-cols-2"
          )}
        >
          {summary.items.map(({ account, rule, balanceMinor, forecast }) => {
            const apiRule = apiRuleMap.get(rule.id);
            const AccountIcon =
              ACCOUNT_TYPE_ICONS[account.type] ?? PiggyBank;
            const radarTone = getRadarBadgeTone(forecast.radar.status);

            let radarLabel = t.plans.savings.radar.base;
            if (forecast.radar.status === "active" && forecast.radar.daysLeft !== null) {
              radarLabel = t.plans.savings.radar.active.replace(
                "{days}",
                String(forecast.radar.daysLeft)
              );
            } else if (
              forecast.radar.status === "expiring_soon" &&
              forecast.radar.daysLeft !== null
            ) {
              radarLabel = t.plans.savings.radar.expiring_soon.replace(
                "{days}",
                String(forecast.radar.daysLeft)
              );
            } else if (forecast.radar.status === "expired") {
              radarLabel = t.plans.savings.radar.expired;
            }

            return (
              <Card key={rule.id} className="flex flex-col justify-between space-y-3.5 p-4">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)]">
                      <AccountIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-[var(--strata-text-primary)] sm:text-[15px]">
                        {account.name}
                      </div>
                      <div className="text-xs text-[var(--strata-text-muted)]">
                        <AmountText minor={balanceMinor} currency={baseCurrency} />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={radarTone}>{radarLabel}</Badge>
                    {apiRule ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t.capital.actionsLabel}
                            className="h-8 w-8 rounded-xl"
                          >
                            <MoreHorizontal
                              className="h-4 w-4"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              openQuickAdd({
                                type: "passive_income",
                                accountFromId: account.id,
                                comment: account.name,
                              })
                            }
                          >
                            <TrendingUp
                              className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span>{t.plans.savings.recordInterest}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onOpenRuleForm(apiRule, null)}>
                            <Pencil
                              className="h-3.5 w-3.5 text-[var(--strata-text-secondary)]"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            <span>{t.plans.savings.editRule}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setDeletingRule(apiRule)}
                            className="text-[var(--strata-money-expense)] focus:text-[var(--strata-money-expense)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                            <span>{t.plans.savings.deleteRule}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="strata-money text-2xl font-extrabold tracking-tight text-[var(--strata-text-primary)]">
                      {formatRate(forecast.effectiveRate)}
                    </span>
                    <span className="text-xs text-[var(--strata-text-muted)]">
                      {t.plans.savings.effectiveRateLabel}
                    </span>
                  </div>

                  <div className="text-right text-xs text-[var(--strata-text-muted)]">
                    {rule.promoRate > 0 && rule.promoEndDate
                      ? t.plans.savings.promoUntil
                          .replace("{rate}", formatRate(rule.promoRate))
                          .replace("{date}", formatShortDate(rule.promoEndDate))
                      : `${t.plans.savings.baseRateLabel}: ${formatRate(rule.baseRate)}`}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--strata-text-muted)]">
                  <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                    {rule.accrualType === "min_balance"
                      ? t.plans.savings.accrualMinBalance
                      : t.plans.savings.accrualDaily}
                  </span>
                  <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                    {rule.capitalization
                      ? t.plans.savings.capitalizationOn
                      : t.plans.savings.capitalizationOff}
                  </span>
                  {rule.accrualType === "min_balance" &&
                  rule.minBalanceOverrideMinor !== null ? (
                    <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5">
                      <AmountText
                        minor={rule.minBalanceOverrideMinor}
                        currency={baseCurrency}
                      />
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-[var(--strata-bg-elevated)] px-3 py-2.5">
                    <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                      {t.plans.savings.monthlyForecast}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-bold text-[var(--strata-money-income)]">
                      <AmountText
                        minor={forecast.monthlyInterestMinor}
                        currency={baseCurrency}
                        showSign
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--strata-bg-elevated)] px-3 py-2.5">
                    <div className="truncate text-[11px] text-[var(--strata-text-muted)]">
                      {t.plans.savings.annualForecast}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-bold text-[var(--strata-money-income)]">
                      <AmountText
                        minor={forecast.annualInterestMinor}
                        currency={baseCurrency}
                        showSign
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Untracked Savings/Deposit Accounts Quick-Setup Strip */}
      {untrackedSavingsAccounts.length > 0 ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Percent
              className="h-4 w-4 text-[var(--strata-text-muted)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-bold text-[var(--strata-text-primary)]">
                {t.plans.savings.untrackedTitle}
              </h3>
              <p className="text-xs text-[var(--strata-text-muted)]">
                {t.plans.savings.untrackedSubtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {untrackedSavingsAccounts.map((acc) => {
              const bal = balances[acc.id] ?? acc.initial_balance_minor;
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-2.5 rounded-2xl bg-[var(--strata-bg-elevated)] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-[var(--strata-text-primary)]">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-[var(--strata-text-muted)]">
                      <AmountText minor={bal} currency={acc.currency} />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenRuleForm(null, acc.id)}
                    className="shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    <span>{t.plans.savings.setRate}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingRule)}
        onOpenChange={(next) => {
          if (!next) setDeletingRule(null);
        }}
        title={t.plans.savings.deleteRuleTitle}
        description={t.plans.savings.deleteRuleBody}
        confirmLabel={t.common.delete}
        busy={deletingBusy}
        onConfirm={() => void handleDeleteRule()}
      />
    </div>
  );
}
