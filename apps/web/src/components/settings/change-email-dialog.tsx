"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpCodeInput, type OtpCodeStatus } from "@/components/ui/otp-code-input";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string | null;
  mfaEnabled: boolean;
  onPendingEmailChange?: (newEmail: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  mfaEnabled,
  onPendingEmailChange,
}: ChangeEmailDialogProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<OtpCodeStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const verifyLockRef = useRef(false);

  const errorId = useId();
  const otpHintId = useId();

  function resetForm() {
    setNewEmail("");
    setPassword("");
    setShowPassword(false);
    setTotpCode("");
    setOtpStatus("idle");
    setSubmitting(false);
    setError(null);
    verifyLockRef.current = false;
  }

  function validateTargetEmail(): string | null {
    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(t.errors.invalidEmail);
      emailRef.current?.focus();
      return null;
    }
    if (currentEmail && trimmed === currentEmail.trim().toLowerCase()) {
      setError(t.errors.sameEmail);
      emailRef.current?.focus();
      return null;
    }
    return trimmed;
  }

  async function submitEmailUpdate(trimmedEmail: string) {
    const supabase = createBrowserSupabaseClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/settings?email_updated=1")}`;
    const { error: updateError } = await supabase.auth.updateUser(
      { email: trimmedEmail },
      { emailRedirectTo }
    );

    if (updateError) {
      const lower = updateError.message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered")) {
        setError(t.errors.emailAlreadyInUse);
      } else {
        setError(updateError.message || t.errors.generic);
      }
      return false;
    }

    onPendingEmailChange?.(trimmedEmail);
    toast.success(t.settings.emailChange.sentToast);
    resetForm();
    onOpenChange(false);
    return true;
  }

  async function handleMfaConfirm(rawCode: string) {
    const code = rawCode.replace(/\s+/g, "");
    if (verifyLockRef.current || !/^\d{6}$/.test(code)) return;

    const trimmedEmail = validateTargetEmail();
    if (!trimmedEmail) {
      setTotpCode("");
      return;
    }

    verifyLockRef.current = true;
    setError(null);
    setOtpStatus("verifying");
    setSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setOtpStatus("error");
        setError(t.errors.generic);
        setTimeout(() => {
          setTotpCode("");
          setOtpStatus("idle");
        }, 420);
        return;
      }

      const verifiedTotpFactors = (factorsData?.totp ?? []).filter(
        (factor) => factor.status === "verified"
      );

      let verified = verifiedTotpFactors.length === 0;
      for (const factor of verifiedTotpFactors) {
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code,
        });
        if (!mfaError) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        setOtpStatus("error");
        setError(t.errors.invalidMfaCode);
        setTimeout(() => {
          setTotpCode("");
          setOtpStatus("idle");
          otpRef.current?.focus();
        }, 420);
        return;
      }

      const updated = await submitEmailUpdate(trimmedEmail);
      if (!updated) {
        setOtpStatus("idle");
        setTotpCode("");
      }
    } catch {
      setOtpStatus("error");
      setError(t.errors.generic);
      setTimeout(() => {
        setTotpCode("");
        setOtpStatus("idle");
      }, 420);
    } finally {
      verifyLockRef.current = false;
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mfaEnabled) {
      void handleMfaConfirm(totpCode);
      return;
    }

    setError(null);
    const trimmedEmail = validateTargetEmail();
    if (!trimmedEmail) return;

    if (!password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const verifyRes = await fetch("/api/v1/security/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!verifyRes.ok) {
        if (verifyRes.status === 401) {
          router.push("/login?reason=session_revoked");
          router.refresh();
          return;
        }
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error === "INVALID_PASSWORD" ? t.errors.invalidPassword : t.errors.generic);
        return;
      }

      await submitEmailUpdate(trimmedEmail);
    } catch {
      setError(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) {
          if (!nextOpen) resetForm();
          onOpenChange(nextOpen);
        }
      }}
      title={t.settings.emailChange.dialogTitle}
      description={
        mfaEnabled
          ? t.settings.emailChange.dialogDescriptionMfa
          : t.settings.emailChange.dialogDescriptionPassword
      }
      dismissible={!submitting}
      maxWidthClassName="sm:max-w-md"
    >
      <form onSubmit={handlePasswordSubmit} method="POST" className="space-y-4">
        {currentEmail ? (
          <div className="flex items-center gap-2 rounded-2xl bg-[var(--strata-bg-elevated)] px-3.5 py-2.5 text-xs">
            <Mail
              className="h-3.5 w-3.5 shrink-0 text-[var(--strata-text-muted)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="text-[var(--strata-text-muted)]">
              {t.settings.emailChange.currentLabel}:
            </span>
            <span className="truncate font-semibold text-[var(--strata-text-primary)]">
              {currentEmail}
            </span>
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

        <div className="space-y-1.5">
          <Label htmlFor="change-email-new">{t.settings.emailChange.newEmailLabel}</Label>
          <Input
            ref={emailRef}
            id="change-email-new"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus
            required
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : undefined}
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="new@example.com"
          />
        </div>

        {mfaEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="change-email-totp">{t.settings.emailChange.totpLabel}</Label>
            <p id={otpHintId} className="text-xs text-[var(--strata-text-muted)]">
              {t.settings.emailChange.totpHint}
            </p>
            <OtpCodeInput
              id="change-email-totp"
              inputRef={otpRef}
              value={totpCode}
              status={otpStatus}
              required
              ariaInvalid={Boolean(error)}
              ariaDescribedBy={error ? `${otpHintId} ${errorId}` : otpHintId}
              onChange={(next) => {
                setTotpCode(next);
                if (error && next.length > 0) setError(null);
              }}
              onComplete={(completed) => {
                void handleMfaConfirm(completed);
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
                  <span>{t.settings.emailChange.submitting}</span>
                </>
              ) : (
                <span>{t.auth.mfaAutoHint}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="change-email-password">{t.settings.dangerZone.passwordLabel}</Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="change-email-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="pr-12"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex min-w-11 cursor-pointer items-center justify-center text-[var(--strata-text-muted)] transition hover:text-[var(--strata-text-primary)]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            {t.common.cancel}
          </Button>
          {!mfaEnabled ? (
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitting ? t.settings.emailChange.submitting : t.settings.emailChange.submitButton}
            </Button>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}
