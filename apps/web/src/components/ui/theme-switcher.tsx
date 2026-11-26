"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "@strata/api-contract";
import { useTheme } from "@/components/providers/theme-provider";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  variant?: "compact" | "segmented";
  syncServer?: boolean;
  value?: Theme;
  onChange?: (next: Theme) => void;
  className?: string;
}

export function ThemeSwitcher({
  variant = "compact",
  syncServer = false,
  value,
  onChange,
  className,
}: ThemeSwitcherProps) {
  const { theme, systemTheme, resolvedTheme, setTheme, toggleCompactTheme } = useTheme();
  const { t } = useI18n();

  const activeTheme = value ?? theme;

  if (variant === "compact") {
    const label =
      resolvedTheme === "dark" ? t.theme.switchToLight : t.theme.switchToDark;
    return (
      <button
        type="button"
        onClick={() => toggleCompactTheme({ syncServer })}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--strata-text-secondary)] transition hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]",
          className
        )}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Moon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {resolvedTheme === "dark" ? t.theme.light : t.theme.dark}
        </span>
      </button>
    );
  }

  const options: Array<{ id: Theme; label: string; icon: typeof Monitor }> = [
    {
      id: "system",
      label:
        systemTheme === "dark"
          ? t.theme.systemCurrentDark
          : t.theme.systemCurrentLight,
      icon: Monitor,
    },
    { id: "light", label: t.theme.light, icon: Sun },
    { id: "dark", label: t.theme.dark, icon: Moon },
  ];

  const handleSelect = (next: Theme) => {
    setTheme(next, { syncServer });
    onChange?.(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.theme.label}
      className={cn("grid grid-cols-1 gap-2 sm:grid-cols-3", className)}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = activeTheme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => handleSelect(opt.id)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
              selected
                ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
                : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)] text-[var(--strata-text-muted)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-secondary)]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
