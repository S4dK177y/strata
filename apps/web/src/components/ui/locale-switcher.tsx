"use client";

import { Languages } from "lucide-react";
import type { Locale } from "@strata/api-contract";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  syncServer?: boolean;
  onChange?: (next: Locale) => void;
  className?: string;
}

export function LocaleSwitcher({
  syncServer = false,
  onChange,
  className,
}: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  const toggle = () => {
    const next: Locale = locale === "ru" ? "en" : "ru";
    setLocale(next, { syncServer });
    onChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.locale.label}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--strata-text-primary)] transition hover:border-[var(--strata-border-strong)]",
        className
      )}
    >
      <Languages className="h-4 w-4 text-[var(--strata-accent-secondary)]" aria-hidden="true" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
