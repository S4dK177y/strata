"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpCodeInput } from "@/components/ui/otp-code-input";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface DangerZoneCardProps {
  mfaEnabled: boolean;
}

export function DangerZoneCard({ mfaEnabled }: DangerZoneCardProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpTouched, setTotpTouched] = useState(false);
  const [confirmedIrreversible, setConfirmedIrreversible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);
  const totpHintId = useId();
  const errorId = useId();
  const confirmCheckId = useId();

  function openDialog() {
    setPassword("");
    setShowPassword(false);
    setTotpCode("");
    setTotpTouched(false);
    setConfirmedIrreversible(false);
    setError(null);
    setDialogOpen(true);
  }

  function mapDeleteError(code: string | undefined): string {
    switch (code) {
      case "INVALID_PASSWORD":
        return t.errors.invalidPassword;
      case "MFA_CODE_REQUIRED":
        return t.errors.mfaCodeRequired;
      case "INVALID_MFA_CODE":
        return t.errors.invalidMfaCode;
      case "LAST_ADMIN_CANNOT_DELETE":
        return t.errors.lastAdminCannotDelete;
      default:
        return t.errors.generic;
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!password) {
      passwordRef.current?.focus();
      return;
    }

    const trimmedTotp = totpCode.replace(/\s+/g, "");
    if (mfaEnabled && !/^\d{6}$/.test(trimmedTotp)) {
      setTotpTouched(true);
      setError(t.errors.mfaCodeRequired);
      totpRef.current?.focus();
      return;
    }

    if (!confirmedIrreversible) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/v1/security/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(mfaEnabled ? { totp_code: trimmedTotp } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 401) {
          router.push("/login?reason=session_revoked");
          router.refresh();
          return;
        }
        setError(mapDeleteError(body?.error));
        return;
      }

      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      toast.success(t.settings.dangerZone.deletedToast);
      router.push("/login?deleted=1");
      router.refresh();
    } catch {
      setError(t.errors.generic);
    } finally {
      setDeleting(false);
    }
  }

  const totpInvalid = mfaEnabled && totpTouched && !/^\d{6}$/.test(totpCode);

  return (
    <>
      <Card className="space-y-4 border-[var(--strata-money-expense)]/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <CardHeader className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg text-[var(--strata-money-expense)]">
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {t.settings.dangerZone.title}
            </CardTitle>
            <CardDescription>{t.settings.dangerZone.subtitle}</CardDescription>
          </CardHeader>

          <Button
            type="button"
            variant="destructive"
            onClick={openDialog}
            className="w-full shrink-0 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {t.settings.dangerZone.openButton}
          </Button>
        </div>

        <p className="rounded-2xl bg-[var(--strata-bg-elevated)] px-4 py-3 text-xs leading-relaxed text-[var(--strata-text-muted)]">
          {t.settings.dangerZone.warningText}
        </p>
      </Card>

      <ModalDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!deleting) setDialogOpen(open);
        }}
        title={t.settings.dangerZone.dialogTitle}
        description={t.settings.dangerZone.dialogDescription}
        dismissible={!deleting}
        maxWidthClassName="sm:max-w-md"
      >
        <form onSubmit={handleSubmit} method="POST" className="space-y-4">
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
            <Label htmlFor="delete-account-password">
              {t.settings.dangerZone.passwordLabel}
            </Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="delete-account-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint={mfaEnabled ? "next" : "done"}
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

          {mfaEnabled ? (
            <div className="space-y-1.5">
              <Label htmlFor="delete-account-totp">
                {t.settings.dangerZone.totpLabel}
              </Label>
              <p id={totpHintId} className="text-xs text-[var(--strata-text-muted)]">
                {t.settings.dangerZone.totpHint}
              </p>
              <OtpCodeInput
                id="delete-account-totp"
                inputRef={totpRef}
                value={totpCode}
                status={deleting ? "verifying" : "idle"}
                required
                ariaInvalid={Boolean(totpInvalid)}
                ariaDescribedBy={error ? `${totpHintId} ${errorId}` : totpHintId}
                onChange={(digitsOnly) => {
                  setTotpCode(digitsOnly);
                  if (error && /^\d{6}$/.test(digitsOnly)) {
                    setError(null);
                  }
                }}
                onBlur={() => setTotpTouched(true)}
              />
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5">
            <input
              id={confirmCheckId}
              name="confirmDelete"
              type="checkbox"
              required
              checked={confirmedIrreversible}
              onChange={(e) => setConfirmedIrreversible(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--strata-money-expense)]"
            />
            <label
              htmlFor={confirmCheckId}
              className="cursor-pointer text-xs leading-relaxed text-[var(--strata-text-secondary)]"
            >
              {t.settings.dangerZone.confirmCheck}
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={deleting || !confirmedIrreversible}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {deleting ? t.settings.dangerZone.deleting : t.settings.dangerZone.confirmButton}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </>
  );
}
