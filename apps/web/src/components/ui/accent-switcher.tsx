"use client";

import type { AccentPalette } from "@strata/api-contract";
import { useTheme } from "@/components/providers/theme-provider";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface AccentSwitcherProps {
  syncServer?: boolean;
  value?: AccentPalette;
  onChange?: (next: AccentPalette) => void;
  className?: string;
}

const ACCENT_OPTIONS: Array<{ id: AccentPalette; swatchVar: string }> = [
  { id: "emerald", swatchVar: "var(--strata-swatch-emerald)" },
  { id: "ocean", swatchVar: "var(--strata-swatch-ocean)" },
  { id: "amethyst", swatchVar: "var(--strata-swatch-amethyst)" },
  { id: "sunset", swatchVar: "var(--strata-swatch-sunset)" },
  { id: "graphite", swatchVar: "var(--strata-swatch-graphite)" },
];

export function AccentSwitcher({
  syncServer = false,
  value,
  onChange,
  className,
}: AccentSwitcherProps) {
  const { accent, setAccent } = useTheme();
  const { t } = useI18n();

  const activeAccent = value ?? accent;

  const handleSelect = (next: AccentPalette) => {
    setAccent(next, { syncServer });
    onChange?.(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.accent.label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {ACCENT_OPTIONS.map((opt) => {
        const selected = activeAccent === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => handleSelect(opt.id)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
              selected
                ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)] ring-1 ring-[var(--strata-accent-brand)]/40"
                : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)] text-[var(--strata-text-muted)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-secondary)]"
            )}
          >
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: opt.swatchVar }}
            />
            <span>{t.accent[opt.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
