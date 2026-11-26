"use client";

import { useI18n } from "@/lib/i18n/client";
import { cn, formatMoneyMinor } from "@/lib/utils";

interface AmountTextProps {
  minor: number;
  currency?: string;
  showSign?: boolean;
  className?: string;
}

export function AmountText({
  minor,
  currency = "RUB",
  showSign = false,
  className,
}: AmountTextProps) {
  const { locale } = useI18n();
  const absFormatted = formatMoneyMinor(Math.abs(minor), currency, locale);
  const prefix = minor < 0 ? "−" : showSign && minor > 0 ? "+" : "";

  return (
    <span className={cn("strata-money", className)}>
      {prefix}
      {absFormatted}
    </span>
  );
}
