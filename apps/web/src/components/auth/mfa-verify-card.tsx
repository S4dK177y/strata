"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useAuthTransition } from "@/components/providers/auth-transition-provider";
import { AuroraCurtains } from "@/components/ui/aurora-curtains";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { OtpCodeInput, type OtpCodeStatus } from "@/components/ui/otp-code-input";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface MfaVerifyCardProps {
  email: string | null;
  safeNext: string;
}

export function MfaVerifyCard({ email, safeNext }: MfaVerifyCardProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { triggerAuthFlash } = useAuthTransition();

  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [otpStatus, setOtpStatus] = useState<OtpCodeStatus>("idle");
  const [authVisualState, setAuthVisualState] = useState<"idle" | "submitting" | "entering">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const otpBoxRef = useRef<HTMLDivElement>(null);
  const verifyLockRef = useRef(false);
  const hintId = useId();
  const errorId = useId();

  const isInvalidFormat = touched && code.length > 0 && !/^\d{6}$/.test(code);

  const completeMfaTransition = useCallback(async () => {
    setOtpStatus("success");
    setAuthVisualState("entering");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const rect = otpBoxRef.current?.getBoundingClientRect();
      triggerAuthFlash(
        rect
          ? {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            }
          : undefined
      );
      await new Promise((resolve) => setTimeout(resolve, 380));
    }
    router.push(safeNext);
    router.refresh();
  }, [router, safeNext, triggerAuthFlash]);

  const verifyCode = useCallback(
    async (rawCode: string) => {
      const trimmedCode = rawCode.replace(/\s+/g, "");
      if (verifyLockRef.current || !/^\d{6}$/.test(trimmedCode)) {
        return;
      }

      verifyLockRef.current = true;
      setTouched(true);
      setError(null);
      setOtpStatus("verifying");
      setAuthVisualState("submitting");

      try {
        const supabase = createBrowserSupabaseClient();
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          setOtpStatus("error");
          setAuthVisualState("idle");
          setError(t.errors.generic);
          setTimeout(() => {
            setCode("");
            setOtpStatus("idle");
            inputRef.current?.focus();
          }, 400);
          return;
        }

        const verifiedTotpFactors = (factorsData?.totp ?? []).filter(
          (factor) => factor.status === "verified"
        );

        if (verifiedTotpFactors.length === 0) {
          await completeMfaTransition();
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
          setOtpStatus("error");
          setAuthVisualState("idle");
          setError(t.errors.invalidMfaCode);
          setTimeout(() => {
            setCode("");
            setOtpStatus("idle");
            inputRef.current?.focus();
          }, 420);
          return;
        }

        await completeMfaTransition();
      } catch {
        setOtpStatus("error");
        setAuthVisualState("idle");
        setError(t.errors.generic);
        setTimeout(() => {
          setCode("");
          setOtpStatus("idle");
          inputRef.current?.focus();
        }, 420);
      } finally {
        verifyLockRef.current = false;
      }
    },
    [completeMfaTransition, t.errors.generic, t.errors.invalidMfaCode]
  );

  return (
    <div
      data-aurora="curtains"
      data-auth-state={authVisualState}
      className="strata-aurora-screen flex min-h-screen flex-col"
    >
      <AuroraCurtains state={authVisualState} />
      <header className="strata-auth-header mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
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
        <div className="strata-frosted strata-auth-card space-y-6 rounded-[28px] p-6 sm:p-8">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
              <ShieldCheck
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode(code);
            }}
            method="POST"
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="mfa-totp-code">{t.auth.mfaCodeLabel}</Label>
              <p id={hintId} className="text-xs text-[var(--strata-text-muted)]">
                {t.auth.mfaCodeHint}
              </p>

              <OtpCodeInput
                id="mfa-totp-code"
                inputRef={inputRef}
                containerRef={otpBoxRef}
                value={code}
                status={otpStatus}
                autoFocus
                required
                ariaInvalid={Boolean(error || isInvalidFormat)}
                ariaDescribedBy={error ? `${hintId} ${errorId}` : hintId}
                onChange={(next) => {
                  setCode(next);
                  if (error && next.length > 0) {
                    setError(null);
                  }
                }}
                onBlur={() => setTouched(true)}
                onComplete={(completed) => {
                  void verifyCode(completed);
                }}
              />

              <div
                role="status"
                aria-live="polite"
                className="flex min-h-5 items-center justify-center gap-2 text-xs text-[var(--strata-text-muted)]"
              >
                {otpStatus === "verifying" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>{t.auth.mfaSubmitting}</span>
                  </>
                ) : (
                  <span>{t.auth.mfaAutoHint}</span>
                )}
              </div>
            </div>
          </form>

          <form
            action="/auth/signout"
            method="post"
            className="border-t border-[var(--strata-border-subtle)] pt-4"
          >
            <Button
              type="submit"
              variant="ghost"
              className="w-full"
              disabled={otpStatus === "verifying" || otpStatus === "success"}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.auth.mfaSwitchAccount}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
