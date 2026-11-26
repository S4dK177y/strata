import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "brand" | "neon" | "warn" | "passive";
}

const TONE_CLASSES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  default:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)] border-[var(--strata-border-subtle)]",
  brand:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-brand)] border-[var(--strata-border-glow)]",
  neon:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-neon)] border-[var(--strata-border-glow)]",
  warn:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-radar-warn)] border-[var(--strata-border-subtle)]",
  passive:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-secondary)] border-[var(--strata-border-subtle)]",
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
