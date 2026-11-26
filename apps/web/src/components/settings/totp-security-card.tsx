"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import type { AalLevel } from "@strata/api-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalDialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { OtpCodeInput, type OtpCodeStatus } from "@/components/ui/otp-code-input";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
  const [enrollStatus, setEnrollStatus] = useState<OtpCodeStatus>("idle");

  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableTouched, setDisableTouched] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableStatus, setDisableStatus] = useState<OtpCodeStatus>("idle");

  const enrollInputRef = useRef<HTMLInputElement>(null);
  const disableInputRef = useRef<HTMLInputElement>(null);
  const enrollLockRef = useRef(false);
  const disableLockRef = useRef(false);

  const enrollHintId = useId();
  const enrollErrorId = useId();
  const disableHintId = useId();
  const disableErrorId = useId();

  const refreshFactors = useCallback(async () => {
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
  }, [onMfaChanged]);

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
      // Best-effort cleanup
    }
  }

  async function handleStartEnroll() {
    setEnrolling(true);
    setEnrollError(null);
    setEnrollCode("");
    setEnrollTouched(false);
    setEnrollStatus("idle");
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
    if (!open && enrollStatus !== "verifying") {
      const factorToClean = pendingFactorId;
      setEnrollOpen(false);
      setPendingFactorId(null);
      setQrCode(null);
      setSecret(null);
      setEnrollCode("");
      setEnrollError(null);
      setEnrollStatus("idle");
      await cleanupPendingFactor(factorToClean);
      return;
    }
    setEnrollOpen(open);
  }

  async function verifyEnrollCode(rawCode: string) {
    const trimmed = rawCode.replace(/\s+/g, "");
    if (enrollLockRef.current || !/^\d{6}$/.test(trimmed)) return;
    if (!pendingFactorId) {
      setEnrollError(t.errors.generic);
      return;
    }

    enrollLockRef.current = true;
    setEnrollTouched(true);
    setEnrollError(null);
    setEnrollStatus("verifying");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: trimmed,
      });

      if (error) {
        setEnrollStatus("error");
        setEnrollError(t.errors.invalidMfaCode);
        setTimeout(() => {
          setEnrollCode("");
          setEnrollStatus("idle");
          enrollInputRef.current?.focus();
        }, 420);
        return;
      }

      setEnrollStatus("success");
      setPendingFactorId(null);
      setEnrollOpen(false);
      setQrCode(null);
      setSecret(null);
      setEnrollCode("");
      setEnrollStatus("idle");
      toast.success(t.settings.totp.enabledToast);
      await refreshFactors();
      router.refresh();
    } catch {
      setEnrollStatus("error");
      setEnrollError(t.errors.generic);
      setTimeout(() => {
        setEnrollCode("");
        setEnrollStatus("idle");
        enrollInputRef.current?.focus();
      }, 420);
    } finally {
      enrollLockRef.current = false;
    }
  }

  async function verifyDisableCode(rawCode: string) {
    const trimmed = rawCode.replace(/\s+/g, "");
    if (disableLockRef.current || !/^\d{6}$/.test(trimmed)) return;
    if (!activeFactor) {
      setDisableOpen(false);
      return;
    }

    disableLockRef.current = true;
    setDisableTouched(true);
    setDisableError(null);
    setDisableStatus("verifying");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactor.id,
        code: trimmed,
      });

      if (verifyError) {
        setDisableStatus("error");
        setDisableError(t.errors.invalidMfaCode);
        setTimeout(() => {
          setDisableCode("");
          setDisableStatus("idle");
          disableInputRef.current?.focus();
        }, 420);
        return;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: activeFactor.id,
      });

      if (unenrollError) {
        setDisableStatus("error");
        setDisableError(unenrollError.message || t.errors.generic);
        setTimeout(() => {
          setDisableCode("");
          setDisableStatus("idle");
        }, 420);
        return;
      }

      await supabase.auth.refreshSession().catch(() => {});
      setDisableStatus("success");
      setDisableOpen(false);
      setDisableCode("");
      setDisableError(null);
      setDisableStatus("idle");
      toast.success(t.settings.totp.disabledToast);
      await refreshFactors();
      router.refresh();
    } catch {
      setDisableStatus("error");
      setDisableError(t.errors.generic);
      setTimeout(() => {
        setDisableCode("");
        setDisableStatus("idle");
        disableInputRef.current?.focus();
      }, 420);
    } finally {
      disableLockRef.current = false;
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

  const enrollInvalid = enrollTouched && enrollCode.length > 0 && !/^\d{6}$/.test(enrollCode);
  const disableInvalid = disableTouched && disableCode.length > 0 && !/^\d{6}$/.test(disableCode);

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <CardHeader className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound
                  className="h-4 w-4 shrink-0 text-[var(--strata-text-muted)]"
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
              className="w-full shrink-0 sm:w-auto"
              onClick={() => {
                setDisableCode("");
                setDisableError(null);
                setDisableTouched(false);
                setDisableStatus("idle");
                setDisableOpen(true);
              }}
            >
              <ShieldOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.settings.totp.disableButton}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loadingFactors || enrolling}
              onClick={handleStartEnroll}
              className="w-full shrink-0 sm:w-auto"
            >
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
        dismissible={enrollStatus !== "verifying"}
        maxWidthClassName="sm:max-w-md"
      >
        {enrolling ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--strata-text-muted)]" aria-hidden="true" />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyEnrollCode(enrollCode);
            }}
            method="POST"
            className="space-y-5"
          >
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

            <div className="space-y-2">
              <Label htmlFor="enroll-totp-code">{t.settings.totp.codeLabel}</Label>
              <p id={enrollHintId} className="text-xs text-[var(--strata-text-muted)]">
                {t.settings.totp.codeHint}
              </p>
              <OtpCodeInput
                id="enroll-totp-code"
                inputRef={enrollInputRef}
                value={enrollCode}
                status={enrollStatus}
                required
                ariaInvalid={Boolean(enrollError || enrollInvalid)}
                ariaDescribedBy={enrollError ? `${enrollHintId} ${enrollErrorId}` : enrollHintId}
                onChange={(next) => {
                  setEnrollCode(next);
                  if (enrollError && next.length > 0) {
                    setEnrollError(null);
                  }
                }}
                onBlur={() => setEnrollTouched(true)}
                onComplete={(completed) => {
                  void verifyEnrollCode(completed);
                }}
              />
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-5 items-center justify-center gap-2 text-xs text-[var(--strata-text-muted)]"
              >
                {enrollStatus === "verifying" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>{t.settings.totp.enabling}</span>
                  </>
                ) : (
                  <span>{t.auth.mfaAutoHint}</span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={enrollStatus === "verifying"}
                onClick={() => {
                  void handleEnrollDialogChange(false);
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>

      <ModalDialog
        open={disableOpen}
        onOpenChange={(open) => {
          if (disableStatus !== "verifying") setDisableOpen(open);
        }}
        title={t.settings.totp.disableTitle}
        description={t.settings.totp.disableDescription}
        dismissible={disableStatus !== "verifying"}
        maxWidthClassName="sm:max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyDisableCode(disableCode);
          }}
          method="POST"
          className="space-y-4"
        >
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

          <div className="space-y-2">
            <Label htmlFor="disable-totp-code">{t.settings.totp.codeLabel}</Label>
            <p id={disableHintId} className="text-xs text-[var(--strata-text-muted)]">
              {t.settings.totp.codeHint}
            </p>
            <OtpCodeInput
              id="disable-totp-code"
              inputRef={disableInputRef}
              value={disableCode}
              status={disableStatus}
              autoFocus
              required
              ariaInvalid={Boolean(disableError || disableInvalid)}
              ariaDescribedBy={disableError ? `${disableHintId} ${disableErrorId}` : disableHintId}
              onChange={(next) => {
                setDisableCode(next);
                if (disableError && next.length > 0) {
                  setDisableError(null);
                }
              }}
              onBlur={() => setDisableTouched(true)}
              onComplete={(completed) => {
                void verifyDisableCode(completed);
              }}
            />
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-5 items-center justify-center gap-2 text-xs text-[var(--strata-text-muted)]"
            >
              {disableStatus === "verifying" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>{t.settings.totp.disabling}</span>
                </>
              ) : (
                <span>{t.auth.mfaAutoHint}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="secondary"
              disabled={disableStatus === "verifying"}
              onClick={() => setDisableOpen(false)}
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
