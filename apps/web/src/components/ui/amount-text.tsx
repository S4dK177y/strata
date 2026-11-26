"use client";

import { useI18n } from "@/lib/i18n/client";
import { cn, splitMoneyMinor } from "@/lib/utils";

interface AmountTextProps {
  minor: number;
  currency?: string;
  showSign?: boolean;
  alwaysShowDecimals?: boolean;
  mutedFraction?: boolean;
  className?: string;
}

export function AmountText({
  minor,
  currency = "RUB",
  showSign = false,
  alwaysShowDecimals = false,
  mutedFraction = true,
  className,
}: AmountTextProps) {
  const { locale } = useI18n();
  const { integerPart, fractionPart, symbol } = splitMoneyMinor(minor, currency, locale, {
    alwaysShowDecimals,
  });
  const prefix = minor < 0 ? "−" : showSign && minor > 0 ? "+" : "";

  return (
    <span className={cn("strata-money", className)}>
      <span>
        {prefix}
        {integerPart}
      </span>
      <span className={mutedFraction ? "opacity-55" : undefined}>
        {fractionPart} {symbol}
      </span>
    </span>
  );
}
