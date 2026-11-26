import { evaluateAmountExpression } from "@strata/finance-core";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@strata/api-contract";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  GBP: "£",
  KZT: "₸",
  TRY: "₺",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
}

export function splitMoneyMinor(
  minor: number,
  currency: string,
  locale: Locale,
  opts?: { alwaysShowDecimals?: boolean }
): { integerPart: string; fractionPart: string; symbol: string } {
  const absMinor = Math.abs(Math.trunc(minor));
  const whole = Math.floor(absMinor / 100);
  const cents = absMinor % 100;
  const showDecimals = Boolean(opts?.alwaysShowDecimals || cents !== 0);

  const integerPart = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 0,
  }).format(whole);

  const decimalSep = locale === "ru" ? "," : ".";
  const fractionPart = showDecimals
    ? `${decimalSep}${String(cents).padStart(2, "0")}`
    : "";

  return {
    integerPart,
    fractionPart,
    symbol: getCurrencySymbol(currency),
  };
}

export function formatMoneyMinor(
  minor: number,
  currency: string,
  locale: Locale
): string {
  const { integerPart, fractionPart, symbol } = splitMoneyMinor(minor, currency, locale);
  return `${integerPart}${fractionPart} ${symbol}`;
}

export function parseAmountInputToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || /^=?\s*0+(?:[.,]0{1,2})?\s*$/.test(trimmed)) {
    return 0;
  }
  return evaluateAmountExpression(trimmed);
}
