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
          "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--strata-text-primary)] transition hover:border-[var(--strata-border-strong)]",
          className
        )}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-4 w-4 text-[var(--strata-radar-warn)]" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4 text-[var(--strata-accent-brand)]" aria-hidden="true" />
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
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition",
              selected
                ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)] shadow-[var(--strata-shadow-card)]"
                : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-muted)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
