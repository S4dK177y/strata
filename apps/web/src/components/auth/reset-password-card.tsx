"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ResetPasswordCard() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.errors.passwordMinLength);
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      toast.success(t.auth.passwordUpdated);
      router.push("/");
      router.refresh();
    } catch {
      setError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="strata-canvas-ambient flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt={t.common.brand} className="h-8 w-8 rounded-lg" />
          <span className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
            {t.common.brand}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher variant="compact" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-10">
        <Card className="space-y-5">
          <CardHeader>
            <CardTitle>{t.auth.newPasswordTitle}</CardTitle>
            <CardDescription>{t.auth.newPasswordSubtitle}</CardDescription>
          </CardHeader>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)] px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t.auth.passwordLabel}</Label>
              <span
                id="new-password-rules"
                className="block text-xs text-[var(--strata-text-muted)]"
              >
                {t.auth.passwordRulesTitle}
              </span>
              <div className="relative">
                <Input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  aria-describedby="new-password-rules"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.common.loading : t.auth.saveNewPassword}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
