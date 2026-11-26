"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import type { AalLevel } from "@strata/api-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface TotpFactorSummary {
  id: string;
  friendlyName: string | null;
  createdAt: string;
}

interface TotpSecurityCardProps {
  initialMfaEnabled: boolean;
  initialAal: AalLevel;
  onMfaChanged?: (enabled: boolean) => void;
}

function formatSecretBlocks(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function TotpSecurityCard({
  initialMfaEnabled,
  initialAal,
  onMfaChanged,
}: TotpSecurityCardProps) {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [activeFactor, setActiveFactor] = useState<TotpFactorSummary | null>(null);
  const [loadingFactors, setLoadingFactors] = useState(true);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [enrollCode, setEnrollCode] = useState("");
  const [enrollTouched, setEnrollTouched] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [verifyingEnroll, setVerifyingEnroll] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableTouched, setDisableTouched] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  const enrollInputRef = useRef<HTMLInputElement>(null);
  const disableInputRef = useRef<HTMLInputElement>(null);
  const enrollHintId = useId();
  const enrollErrorId = useId();
  const disableHintId = useId();
  const disableErrorId = useId();

  async function refreshFactors() {
    setLoadingFactors(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        return;
      }

      const verified = data.totp.find((f) => f.status === "verified") ?? null;
      if (verified) {
        setActiveFactor({
          id: verified.id,
          friendlyName: verified.friendly_name ?? null,
          createdAt: verified.created_at,
        });
        setMfaEnabled(true);
        onMfaChanged?.(true);
      } else {
        setActiveFactor(null);
        setMfaEnabled(false);
        onMfaChanged?.(false);
      }
    } finally {
      setLoadingFactors(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!active || error || !data) {
          return;
        }

        const verified = data.totp.find((f) => f.status === "verified") ?? null;
        if (verified) {
          setActiveFactor({
            id: verified.id,
            friendlyName: verified.friendly_name ?? null,
            createdAt: verified.created_at,
          });
          setMfaEnabled(true);
          onMfaChanged?.(true);
        } else {
          setActiveFactor(null);
          setMfaEnabled(false);
          onMfaChanged?.(false);
        }
      } finally {
        if (active) {
          setLoadingFactors(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cleanupPendingFactor(factorId: string | null) {
    if (!factorId) return;
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.mfa.unenroll({ factorId });
    } catch {
      // Best-effort cleanup of unverified enrollment
    }
  }

  async function handleStartEnroll() {
    setEnrolling(true);
    setEnrollError(null);
    setEnrollCode("");
    setEnrollTouched(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCopiedSecret(false);
    setEnrollOpen(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const staleUnverified = (existing?.all ?? []).filter(
        (factor) => factor.factor_type === "totp" && factor.status === "unverified"
      );
      for (const stale of staleUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id }).catch(() => {});
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Strata",
        friendlyName: "Strata Authenticator",
      });

      if (error || !data) {
        setEnrollOpen(false);
        toast.error(error?.message || t.errors.generic);
        return;
      }

      setPendingFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch {
      setEnrollOpen(false);
      toast.error(t.errors.generic);
    } finally {
      setEnrolling(false);
    }
  }

  async function handleEnrollDialogChange(open: boolean) {
    if (!open && !verifyingEnroll) {
      const factorToClean = pendingFactorId;
      setEnrollOpen(false);
      setPendingFactorId(null);
      setQrCode(null);
      setSecret(null);
      setEnrollCode("");
      setEnrollError(null);
      await cleanupPendingFactor(factorToClean);
      return;
    }
    setEnrollOpen(open);
  }

  async function handleConfirmEnroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnrollTouched(true);
    setEnrollError(null);

    const trimmed = enrollCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setEnrollError(t.errors.mfaCodeRequired);
      enrollInputRef.current?.focus();
      return;
    }

    if (!pendingFactorId) {
      setEnrollError(t.errors.generic);
      return;
    }

    setVerifyingEnroll(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: trimmed,
      });

      if (error) {
        setEnrollError(t.errors.invalidMfaCode);
        enrollInputRef.current?.focus();
        return;
      }

      setPendingFactorId(null);
      setEnrollOpen(false);
      setQrCode(null);
      setSecret(null);
      setEnrollCode("");
      toast.success(t.settings.totp.enabledToast);
      await refreshFactors();
      router.refresh();
    } catch {
      setEnrollError(t.errors.generic);
    } finally {
      setVerifyingEnroll(false);
    }
  }

  async function handleConfirmDisable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDisableTouched(true);
    setDisableError(null);

    const trimmed = disableCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setDisableError(t.errors.mfaCodeRequired);
      disableInputRef.current?.focus();
      return;
    }

    if (!activeFactor) {
      setDisableOpen(false);
      return;
    }

    setDisabling(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactor.id,
        code: trimmed,
      });

      if (verifyError) {
        setDisableError(t.errors.invalidMfaCode);
        disableInputRef.current?.focus();
        return;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: activeFactor.id,
      });

      if (unenrollError) {
        setDisableError(unenrollError.message || t.errors.generic);
        return;
      }

      await supabase.auth.refreshSession().catch(() => {});
      setDisableOpen(false);
      setDisableCode("");
      setDisableError(null);
      toast.success(t.settings.totp.disabledToast);
      await refreshFactors();
      router.refresh();
    } catch {
      setDisableError(t.errors.generic);
    } finally {
      setDisabling(false);
    }
  }

  async function handleCopySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast.success(t.settings.totp.secretCopied);
    } catch {
      toast.error(t.errors.generic);
    }
  }

  const formattedDate = activeFactor?.createdAt
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
        dateStyle: "medium",
      }).format(new Date(activeFactor.createdAt))
    : null;

  const enrollInvalid = enrollTouched && !/^\d{6}$/.test(enrollCode);
  const disableInvalid = disableTouched && !/^\d{6}$/.test(disableCode);

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardHeader className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound
                  className="h-4 w-4 text-[var(--strata-text-muted)]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {t.settings.totp.title}
              </CardTitle>
              <Badge tone={mfaEnabled ? "brand" : "default"}>
                {mfaEnabled ? t.settings.totp.enabledBadge : t.settings.totp.disabledBadge}
              </Badge>
              {mfaEnabled && initialAal === "aal2" ? (
                <Badge tone="default">AAL2</Badge>
              ) : null}
            </div>
            <CardDescription>{t.settings.totp.subtitle}</CardDescription>
          </CardHeader>

          {mfaEnabled ? (
            <Button
              type="button"
              variant="outline"
              disabled={loadingFactors}
              onClick={() => {
                setDisableCode("");
                setDisableError(null);
                setDisableTouched(false);
                setDisableOpen(true);
              }}
            >
              <ShieldOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.settings.totp.disableButton}
            </Button>
          ) : (
            <Button type="button" disabled={loadingFactors || enrolling} onClick={handleStartEnroll}>
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.settings.totp.enableButton}
            </Button>
          )}
        </div>

        {mfaEnabled && activeFactor ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] px-4 py-3 text-sm">
            <div className="space-y-0.5">
              <p className="font-semibold text-[var(--strata-text-primary)]">
                {activeFactor.friendlyName || t.settings.totp.activeFactorLabel}
              </p>
              {formattedDate ? (
                <p className="text-xs text-[var(--strata-text-muted)]">
                  {t.settings.totp.enrolledAt.replace("{date}", formattedDate)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <ModalDialog
        open={enrollOpen}
        onOpenChange={(open) => {
          void handleEnrollDialogChange(open);
        }}
        title={t.settings.totp.enrollTitle}
        description={t.settings.totp.enrollDescription}
        dismissible={!verifyingEnroll}
        maxWidthClassName="sm:max-w-md"
      >
        {enrolling ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--strata-text-muted)]" aria-hidden="true" />
          </div>
        ) : (
          <form onSubmit={handleConfirmEnroll} method="POST" className="space-y-5">
            {qrCode ? (
              <div className="mx-auto flex w-fit items-center justify-center rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-surface-qr)] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt={t.settings.totp.qrAlt}
                  width={176}
                  height={176}
                  className="h-44 w-44"
                />
              </div>
            ) : null}

            {secret ? (
              <div className="space-y-1.5">
                <Label>{t.settings.totp.manualSecretLabel}</Label>
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-elevated)] px-3.5 py-2.5">
                  <code className="strata-mono break-all text-xs font-semibold tracking-wider text-[var(--strata-text-primary)]">
                    {formatSecretBlocks(secret)}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleCopySecret}
                    aria-label={t.settings.totp.copySecret}
                  >
                    {copiedSecret ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    {t.settings.totp.copySecret}
                  </Button>
                </div>
              </div>
            ) : null}

            {enrollError ? (
              <div
                id={enrollErrorId}
                role="alert"
                aria-live="polite"
                className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
              >
                {enrollError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="enroll-totp-code">{t.settings.totp.codeLabel}</Label>
              <p id={enrollHintId} className="text-xs text-[var(--strata-text-muted)]">
                {t.settings.totp.codeHint}
              </p>
              <Input
                ref={enrollInputRef}
                id="enroll-totp-code"
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
                required
                aria-invalid={enrollError || enrollInvalid ? "true" : "false"}
                aria-describedby={enrollError ? `${enrollHintId} ${enrollErrorId}` : enrollHintId}
                value={enrollCode}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D+/g, "").slice(0, 6);
                  setEnrollCode(digitsOnly);
                  if (enrollError && /^\d{6}$/.test(digitsOnly)) {
                    setEnrollError(null);
                  }
                }}
                onBlur={() => setEnrollTouched(true)}
                placeholder="000000"
                className={cn(
                  "strata-mono min-h-12 text-center text-lg font-semibold tracking-[0.35em]",
                  (enrollError || enrollInvalid) && "border-[var(--strata-money-expense)]"
                )}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                disabled={verifyingEnroll}
                onClick={() => {
                  void handleEnrollDialogChange(false);
                }}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={verifyingEnroll}>
                {verifyingEnroll ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {verifyingEnroll ? t.settings.totp.enabling : t.settings.totp.confirmEnable}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>

      <ModalDialog
        open={disableOpen}
        onOpenChange={(open) => {
          if (!disabling) setDisableOpen(open);
        }}
        title={t.settings.totp.disableTitle}
        description={t.settings.totp.disableDescription}
        dismissible={!disabling}
        maxWidthClassName="sm:max-w-md"
      >
        <form onSubmit={handleConfirmDisable} method="POST" className="space-y-4">
          {disableError ? (
            <div
              id={disableErrorId}
              role="alert"
              aria-live="polite"
              className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
            >
              {disableError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="disable-totp-code">{t.settings.totp.codeLabel}</Label>
            <p id={disableHintId} className="text-xs text-[var(--strata-text-muted)]">
              {t.settings.totp.codeHint}
            </p>
            <Input
              ref={disableInputRef}
              id="disable-totp-code"
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
              aria-invalid={disableError || disableInvalid ? "true" : "false"}
              aria-describedby={disableError ? `${disableHintId} ${disableErrorId}` : disableHintId}
              value={disableCode}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D+/g, "").slice(0, 6);
                setDisableCode(digitsOnly);
                if (disableError && /^\d{6}$/.test(digitsOnly)) {
                  setDisableError(null);
                }
              }}
              onBlur={() => setDisableTouched(true)}
              placeholder="000000"
              className={cn(
                "strata-mono min-h-12 text-center text-lg font-semibold tracking-[0.35em]",
                (disableError || disableInvalid) && "border-[var(--strata-money-expense)]"
              )}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              disabled={disabling}
              onClick={() => setDisableOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={disabling}>
              {disabling ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {disabling ? t.settings.totp.disabling : t.settings.totp.confirmDisable}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
