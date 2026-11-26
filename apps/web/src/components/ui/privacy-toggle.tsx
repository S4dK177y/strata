"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function PrivacyToggle({ className }: { className?: string }) {
  const { privacyBlur, togglePrivacyBlur } = usePrivacy();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={togglePrivacyBlur}
      aria-pressed={privacyBlur}
      aria-label={t.privacy.label}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition",
        privacyBlur
          ? "border-[var(--strata-border-glow)] bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-neon)]"
          : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] hover:border-[var(--strata-border-strong)]",
        className
      )}
    >
      {privacyBlur ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{t.privacy.label}</span>
    </button>
  );
}
