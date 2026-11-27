import type { Account, SavingsRule } from "./types";

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

export interface SavingsPortfolioItem {
  account: Account;
  rule: SavingsRule;
  balanceMinor: number;
  forecast: SavingsForecast;
}

export interface SavingsPortfolioSummary {
  items: SavingsPortfolioItem[];
  totalTrackedBalanceMinor: number;
  weightedEffectiveRate: number;
  totalMonthlyInterestMinor: number;
  totalAnnualInterestMinor: number;
  activePromoCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  alertCount: number;
}

const RADAR_URGENCY: Record<PromoRadarStatus, number> = {
  expired: 0,
  expiring_soon: 1,
  active: 2,
  base: 3,
};

export function computeSavingsPortfolioSummary(
  accounts: Account[],
  rules: SavingsRule[],
  balances: Record<string, number>,
  asOfDate: string,
  warningThresholdDays = 14,
): SavingsPortfolioSummary {
  const accountMap = new Map<string, Account>();
  for (const acc of accounts) {
    if (!acc.deletedAt && acc.isActive) {
      accountMap.set(acc.id, acc);
    }
  }

  const items: SavingsPortfolioItem[] = [];
  let totalTrackedBalanceMinor = 0;
  let weightedRateNumerator = 0;
  let totalMonthlyInterestMinor = 0;
  let totalAnnualInterestMinor = 0;
  let activePromoCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;

  for (const rule of rules) {
    if (rule.deletedAt) continue;
    const account = accountMap.get(rule.accountId);
    if (!account) continue;

    const balanceMinor = balances[account.id] ?? account.initialBalanceMinor;
    const forecast = computeSavingsForecast(rule, balanceMinor, asOfDate, warningThresholdDays);

    const positiveBalance = Math.max(0, balanceMinor);
    totalTrackedBalanceMinor += positiveBalance;
    weightedRateNumerator += positiveBalance * forecast.effectiveRate;
    totalMonthlyInterestMinor += forecast.monthlyInterestMinor;
    totalAnnualInterestMinor += forecast.annualInterestMinor;

    if (forecast.radar.status === "active") activePromoCount += 1;
    else if (forecast.radar.status === "expiring_soon") expiringSoonCount += 1;
    else if (forecast.radar.status === "expired") expiredCount += 1;

    items.push({
      account,
      rule,
      balanceMinor,
      forecast,
    });
  }

  items.sort((a, b) => {
    const urgencyDiff =
      RADAR_URGENCY[a.forecast.radar.status] - RADAR_URGENCY[b.forecast.radar.status];
    if (urgencyDiff !== 0) return urgencyDiff;

    const daysA = a.forecast.radar.daysLeft ?? 99999;
    const daysB = b.forecast.radar.daysLeft ?? 99999;
    if (daysA !== daysB) return daysA - daysB;

    return b.balanceMinor - a.balanceMinor;
  });

  const weightedEffectiveRate =
    totalTrackedBalanceMinor > 0 ? weightedRateNumerator / totalTrackedBalanceMinor : 0;

  return {
    items,
    totalTrackedBalanceMinor,
    weightedEffectiveRate,
    totalMonthlyInterestMinor,
    totalAnnualInterestMinor,
    activePromoCount,
    expiringSoonCount,
    expiredCount,
    alertCount: expiringSoonCount + expiredCount,
  };
}
