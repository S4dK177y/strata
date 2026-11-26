"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface AuthCardProps {
  safeNext: string;
  initialError?: string | null;
  inviteOnlyEnabled: boolean;
}

export function AuthCard({
  safeNext,
  initialError,
  inviteOnlyEnabled,
}: AuthCardProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "check_email">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(() => {
    if (initialError === "auth_callback_failed") return t.errors.authCallbackFailed;
    if (initialError === "confirm_failed") return t.errors.confirmFailed;
    return null;
  });

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("invalid login credentials")) return t.errors.invalidCredentials;
    if (lower.includes("email not confirmed")) return t.errors.emailNotConfirmed;
    if (lower.includes("already registered") || lower.includes("already exists")) {
      return t.errors.userAlreadyExists;
    }
    return message || t.errors.generic;
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(mapAuthError(error.message));
        return;
      }

      router.push(safeNext);
      router.refresh();
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError(t.errors.passwordMinLength);
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setFormError(mapAuthError(error.message));
        return;
      }

      if (data.session) {
        router.push(safeNext);
        router.refresh();
        return;
      }

      setMode("check_email");
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setFormError(mapAuthError(error.message));
        return;
      }
      toast.success(t.auth.resetSent);
      setMode("signin");
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) {
        toast.error(mapAuthError(error.message));
        return;
      }
      toast.success(t.auth.emailResent);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt={t.common.brand} className="h-10 w-10 rounded-2xl shadow-md" />
          <div>
            <div className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
              {t.common.brand}
            </div>
            {inviteOnlyEnabled ? (
              <Badge tone="neon" className="mt-0.5">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t.common.inviteBadge}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeSwitcher variant="compact" />
        </div>
      </div>

      <Card className="space-y-6">
        {mode === "check_email" ? (
          <div className="space-y-4">
            <CardHeader>
              <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--strata-border-glow)] bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-neon)]">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle>{t.auth.checkEmailTitle}</CardTitle>
              <CardDescription>
                {t.auth.checkEmailBody.replace("{email}", email)}
              </CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-2.5">
              <Button
                variant="secondary"
                onClick={handleResendConfirmation}
                disabled={loading}
              >
                {t.auth.resendEmail}
              </Button>
              <Button variant="ghost" onClick={() => setMode("signin")}>
                {t.auth.backToSignIn}
              </Button>
            </div>
          </div>
        ) : mode === "reset" ? (
          <div className="space-y-5">
            <CardHeader>
              <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--strata-border-glow)] bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-brand)]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle>{t.auth.resetTitle}</CardTitle>
              <CardDescription>{t.auth.resetSubtitle}</CardDescription>
            </CardHeader>

            {formError ? (
              <div
                role="alert"
                className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
              >
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">{t.auth.emailLabel}</Label>
                <span className="block text-xs text-[var(--strata-text-muted)]">
                  {t.auth.emailHint}
                </span>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  enterKeyHint="done"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t.common.loading : t.auth.sendResetLink}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setFormError(null);
                  setMode("signin");
                }}
              >
                {t.auth.backToSignIn}
              </Button>
            </form>
          </div>
        ) : (
          <>
            <CardHeader>
              <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--strata-border-glow)] bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-neon)]">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl">{t.auth.welcomeTitle}</CardTitle>
              <CardDescription>{t.auth.welcomeSubtitle}</CardDescription>
            </CardHeader>

            {formError ? (
              <div
                role="alert"
                className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-elevated)] px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
              >
                {formError}
              </div>
            ) : null}

            <Tabs
              value={mode}
              onValueChange={(v) => {
                setFormError(null);
                setMode(v === "signup" ? "signup" : "signin");
              }}
            >
              <TabsList>
                <TabsTrigger value="signin">{t.auth.signInTab}</TabsTrigger>
                <TabsTrigger value="signup">{t.auth.signUpTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-email">{t.auth.emailLabel}</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      enterKeyHint="next"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="signin-password">{t.auth.passwordLabel}</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setFormError(null);
                          setMode("reset");
                        }}
                        className="cursor-pointer text-xs font-medium text-[var(--strata-accent-secondary)] hover:underline"
                      >
                        {t.auth.forgotPassword}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        enterKeyHint="done"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? t.auth.hidePassword : t.auth.showPassword
                        }
                        className="absolute inset-y-0 right-0 flex min-w-11 cursor-pointer items-center justify-center text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t.common.loading : t.auth.signInSubmit}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">{t.auth.emailLabel}</Label>
                    <span className="block text-xs text-[var(--strata-text-muted)]">
                      {t.auth.emailHint}
                    </span>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      enterKeyHint="next"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">{t.auth.passwordLabel}</Label>
                    <span
                      id="signup-password-rules"
                      className="block text-xs text-[var(--strata-text-muted)]"
                    >
                      {t.auth.passwordRulesTitle}
                    </span>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        enterKeyHint="done"
                        required
                        aria-describedby="signup-password-rules"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? t.auth.hidePassword : t.auth.showPassword
                        }
                        className="absolute inset-y-0 right-0 flex min-w-11 cursor-pointer items-center justify-center text-[var(--strata-text-muted)] hover:text-[var(--strata-text-primary)]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t.common.loading : t.auth.signUpSubmit}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </Card>
    </div>
  );
}
