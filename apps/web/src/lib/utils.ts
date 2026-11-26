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

export function formatMoneyMinor(
  minor: number,
  currency: string,
  locale: Locale
): string {
  const formatter = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(minor / 100)} ${getCurrencySymbol(currency)}`;
}

export function parseAmountInputToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || /^=?\s*0+(?:[.,]0{1,2})?\s*$/.test(trimmed)) {
    return 0;
  }
  return evaluateAmountExpression(trimmed);
}
