import type { SavingsRule } from "./types";

export type PromoRadarStatus = "base" | "active" | "expiring_soon" | "expired";

export interface PromoRadarInfo {
  status: PromoRadarStatus;
  effectiveRate: number;
  daysLeft: number | null;
}

export interface SavingsForecast {
  effectiveRate: number;
  radar: PromoRadarInfo;
  monthlyInterestMinor: number;
  annualInterestMinor: number;
}

function parseUtcDayMs(dateStr: string): number {
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function diffCalendarDays(targetDate: string, asOfDate: string): number {
  const msPerDay = 86_400_000;
  return Math.round((parseUtcDayMs(targetDate) - parseUtcDayMs(asOfDate)) / msPerDay);
}

export function getEffectiveRate(rule: SavingsRule, asOfDate: string): number {
  if (
    rule.promoEndDate &&
    rule.promoRate > 0 &&
    diffCalendarDays(rule.promoEndDate, asOfDate) >= 0
  ) {
    return rule.promoRate;
  }
  return rule.baseRate;
}

export function getPromoRadarStatus(
  rule: SavingsRule,
  asOfDate: string,
  warningThresholdDays = 14,
): PromoRadarInfo {
  const effectiveRate = getEffectiveRate(rule, asOfDate);

  if (!rule.promoEndDate || rule.promoRate <= rule.baseRate) {
    return { status: "base", effectiveRate, daysLeft: null };
  }

  const daysLeft = diffCalendarDays(rule.promoEndDate, asOfDate);
  if (daysLeft < 0) {
    return { status: "expired", effectiveRate, daysLeft: 0 };
  }
  if (daysLeft <= warningThresholdDays) {
    return { status: "expiring_soon", effectiveRate, daysLeft };
  }
  return { status: "active", effectiveRate, daysLeft };
}

export function computeSavingsForecast(
  rule: SavingsRule,
  currentBalanceMinor: number,
  asOfDate: string,
  warningThresholdDays = 14,
): SavingsForecast {
  const radar = getPromoRadarStatus(rule, asOfDate, warningThresholdDays);
  const effectiveRate = radar.effectiveRate;

  const monthlyPrincipalMinor =
    rule.accrualType === "min_balance" && rule.minBalanceOverrideMinor !== null
      ? rule.minBalanceOverrideMinor
      : currentBalanceMinor;

  const monthlyInterestMinor = Math.round((Math.max(0, monthlyPrincipalMinor) * effectiveRate) / 12);

  if (currentBalanceMinor <= 0) {
    return {
      effectiveRate,
      radar,
      monthlyInterestMinor: 0,
      annualInterestMinor: 0,
    };
  }

  const activePromoDays =
    rule.promoEndDate && rule.promoRate > 0
      ? Math.max(0, diffCalendarDays(rule.promoEndDate, asOfDate))
      : 0;
  const promoMonths = activePromoDays > 0 ? Math.min(12, activePromoDays / 30.4375) : 0;
  const baseMonths = 12 - promoMonths;

  let annualInterestMinor: number;
  if (rule.capitalization) {
    const promoFactor = Math.pow(1 + rule.promoRate / 12, promoMonths);
    const baseFactor = Math.pow(1 + rule.baseRate / 12, baseMonths);
    annualInterestMinor = Math.round(currentBalanceMinor * (promoFactor * baseFactor - 1));
  } else {
    const simpleRate =
      (rule.promoRate * promoMonths) / 12 + (rule.baseRate * baseMonths) / 12;
    annualInterestMinor = Math.round(currentBalanceMinor * simpleRate);
  }

  return {
    effectiveRate,
    radar,
    monthlyInterestMinor,
    annualInterestMinor,
  };
}
