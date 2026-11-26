"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";

export function InviteGateCard({ email }: { email: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError(t.invite.invalidError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (
          res.status === 400 ||
          body?.error === "INVALID_OR_EXPIRED_INVITE_CODE"
        ) {
          setError(t.invite.invalidError);
        } else {
          setError(t.invite.genericError);
        }
        return;
      }

      toast.success(t.invite.successToast);
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError(t.invite.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="strata-aurora-screen flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt={t.common.brand} className="h-9 w-9 rounded-xl shadow-sm" />
          <span className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.common.brand}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher
            syncServer
            className="strata-frosted border-[var(--strata-border-subtle)]"
          />
          <ThemeSwitcher
            variant="compact"
            syncServer
            className="strata-frosted border-[var(--strata-border-subtle)]"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center px-4 py-10">
        <div className="strata-frosted space-y-6 rounded-[28px] p-6 sm:p-8">
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {t.invite.title}
            </CardTitle>
            <CardDescription>{t.invite.subtitle}</CardDescription>
          </CardHeader>

          {email ? (
            <div className="rounded-2xl border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/60 px-3.5 py-2.5 text-xs">
              <span className="text-[var(--strata-text-muted)]">{t.invite.signedInAs}: </span>
              <span className="font-semibold text-[var(--strata-text-primary)]">{email}</span>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-code">{t.invite.codeLabel}</Label>
              <span className="block text-xs text-[var(--strata-text-muted)]">
                {t.invite.codeHint}
              </span>
              <Input
                id="invite-code"
                name="inviteCode"
                type="text"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                minLength={4}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t.invite.codePlaceholder}
                className="strata-mono border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-canvas)]/70 tracking-wider focus:bg-[var(--strata-bg-surface)]"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.invite.submitting : t.invite.submit}
            </Button>
          </form>

          <form action="/auth/signout" method="post" className="border-t border-[var(--strata-border-subtle)] pt-4">
            <Button type="submit" variant="ghost" className="w-full">
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.invite.wrongAccount}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
