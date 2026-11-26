"use client";

import { Globe } from "lucide-react";
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
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--strata-text-secondary)] transition hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]",
        className
      )}
    >
      <Globe className="h-3.5 w-3.5 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
      <span>{locale.toUpperCase()}</span>
    </button>
  );
}
