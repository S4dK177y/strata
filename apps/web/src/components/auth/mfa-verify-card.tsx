"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { AuroraCurtains } from "@/components/ui/aurora-curtains";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface MfaVerifyCardProps {
  email: string | null;
  safeNext: string;
}

export function MfaVerifyCard({ email, safeNext }: MfaVerifyCardProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();

  const trimmedCode = code.replace(/\s+/g, "");
  const isInvalidFormat = touched && !/^\d{6}$/.test(trimmedCode);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!/^\d{6}$/.test(trimmedCode)) {
      setError(t.errors.mfaCodeRequired);
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(t.errors.generic);
        return;
      }

      const verifiedTotpFactors = (factorsData?.totp ?? []).filter(
        (factor) => factor.status === "verified"
      );

      if (verifiedTotpFactors.length === 0) {
        router.push(safeNext);
        router.refresh();
        return;
      }

      let verified = false;
      for (const factor of verifiedTotpFactors) {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: trimmedCode,
        });
        if (!verifyError) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        setError(t.errors.invalidMfaCode);
        inputRef.current?.focus();
        return;
      }

      router.push(safeNext);
      router.refresh();
    } catch {
      setError(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-aurora="curtains"
      data-auth-state={submitting ? "submitting" : "idle"}
      className="strata-aurora-screen flex min-h-screen flex-col"
    >
      <AuroraCurtains state={submitting ? "submitting" : "idle"} />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt={t.common.brand} className="h-9 w-9 rounded-xl shadow-sm" />
          <span className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.common.brand}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher className="strata-frosted border-[var(--strata-border-subtle)]" />
          <ThemeSwitcher
            variant="compact"
            className="strata-frosted border-[var(--strata-border-subtle)]"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center px-4 py-10">
        <div className="strata-frosted space-y-6 rounded-[28px] p-6 sm:p-8">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
              <ShieldCheck className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              <span>{t.common.brand} 2FA</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {t.auth.mfaTitle}
            </CardTitle>
            <CardDescription className="text-[var(--strata-text-secondary)]">
              {t.auth.mfaSubtitle}
            </CardDescription>
          </CardHeader>

          {email ? (
            <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/60 px-3.5 py-2.5 text-xs">
              <span className="text-[var(--strata-text-muted)]">{t.invite.signedInAs}: </span>
              <span className="font-semibold text-[var(--strata-text-primary)]">{email}</span>
            </div>
          ) : null}

          {error ? (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} method="POST" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mfa-totp-code">{t.auth.mfaCodeLabel}</Label>
              <p id={hintId} className="text-xs text-[var(--strata-text-muted)]">
                {t.auth.mfaCodeHint}
              </p>
              <Input
                ref={inputRef}
                id="mfa-totp-code"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                pattern="\d{6}"
                maxLength={6}
                enterKeyHint="done"
                autoFocus
                required
                aria-invalid={error || isInvalidFormat ? "true" : "false"}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                value={code}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D+/g, "").slice(0, 6);
                  setCode(digitsOnly);
                  if (error && /^\d{6}$/.test(digitsOnly)) {
                    setError(null);
                  }
                }}
                onBlur={() => setTouched(true)}
                placeholder="000000"
                className={cn(
                  "strata-mono min-h-12 border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/70 text-center text-lg font-semibold tracking-[0.35em] focus:bg-[var(--strata-bg-surface)]",
                  (error || isInvalidFormat) && "border-[var(--strata-money-expense)]"
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitting ? t.auth.mfaSubmitting : t.auth.mfaSubmit}
            </Button>
          </form>

          <form
            action="/auth/signout"
            method="post"
            className="border-t border-[var(--strata-border-subtle)] pt-4"
          >
            <Button type="submit" variant="ghost" className="w-full">
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.auth.mfaSwitchAccount}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
