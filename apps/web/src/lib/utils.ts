import {
  evaluateAmountExpression,
  evaluateSignedAmountExpression,
} from "@strata/finance-core";
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

export function parseSignedAmountInputToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  return evaluateSignedAmountExpression(trimmed);
}

export function minorToEditableInput(minor: number): string {
  const truncated = Math.trunc(minor);
  const sign = truncated < 0 ? "-" : "";
  const abs = Math.abs(truncated);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  if (cents === 0) {
    return `${sign}${whole}`;
  }
  const centsStr = String(cents).padStart(2, "0").replace(/0+$/, "");
  return `${sign}${whole}.${centsStr}`;
}

export function toLocalDateTimeInputValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    return toLocalDateTimeInputValue(new Date());
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDateTimeInputToIso(localVal: string): string {
  const parsed = new Date(localVal);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}
