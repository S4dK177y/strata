"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authVisualState, setAuthVisualState] = useState<"idle" | "submitting" | "entering">(
    "idle"
  );
  const [formError, setFormError] = useState<string | null>(() => {
    if (initialError === "auth_callback_failed") return t.errors.authCallbackFailed;
    if (initialError === "confirm_failed") return t.errors.confirmFailed;
    return null;
  });

  const confirmRef = useRef<HTMLInputElement>(null);
  const confirmErrorId = useId();

  const passwordsMismatch =
    confirmTouched && confirmPassword.length > 0 && confirmPassword !== password;

  function mapAuthError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("invalid login credentials")) return t.errors.invalidCredentials;
    if (lower.includes("email not confirmed")) return t.errors.emailNotConfirmed;
    if (lower.includes("already registered") || lower.includes("already exists")) {
      return t.errors.userAlreadyExists;
    }
    return message || t.errors.generic;
  }

  async function completeLoginTransition() {
    setAuthVisualState("entering");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      await new Promise((resolve) => setTimeout(resolve, 240));
    }
    router.push(safeNext);
    router.refresh();
  }

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    setAuthVisualState("submitting");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthVisualState("idle");
        setFormError(mapAuthError(error.message));
        return;
      }

      await completeLoginTransition();
    } catch {
      setAuthVisualState("idle");
      setFormError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setConfirmTouched(true);

    if (password.length < 8) {
      setFormError(t.errors.passwordMinLength);
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t.errors.passwordsMismatch);
      confirmRef.current?.focus();
      return;
    }

    setLoading(true);
    setAuthVisualState("submitting");
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
        setAuthVisualState("idle");
        setFormError(mapAuthError(error.message));
        return;
      }

      if (data.session) {
        await completeLoginTransition();
        return;
      }

      setAuthVisualState("idle");
      setMode("check_email");
    } catch {
      setAuthVisualState("idle");
      setFormError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    setAuthVisualState("submitting");
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
      setAuthVisualState("idle");
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

  const frostedInputClass =
    "bg-[var(--strata-bg-canvas)]/70 border border-[var(--strata-border-subtle)] focus:bg-[var(--strata-bg-surface)]";

  return (
    <div
      data-auth-state={authVisualState}
      className="strata-aurora-screen flex min-h-screen flex-col"
    >
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
        <div className="strata-frosted strata-auth-card space-y-6 rounded-[28px] p-6 sm:p-8">
          {mode === "check_email" ? (
            <div className="space-y-5">
              <CardHeader>
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--strata-text-secondary)]">
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{email}</span>
                </div>
                <CardTitle>{t.auth.checkEmailTitle}</CardTitle>
                <CardDescription>
                  {t.auth.checkEmailBody.replace("{email}", email)}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-col gap-2.5">
                <Button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setMode("signin");
                  }}
                >
                  {t.auth.signInSubmit}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setFormError(null);
                    setMode("reset");
                  }}
                >
                  {t.auth.forgotPassword}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                >
                  {t.auth.resendEmail}
                </Button>
              </div>
            </div>
          ) : mode === "reset" ? (
            <div className="space-y-5">
              <CardHeader>
                <CardTitle>{t.auth.resetTitle}</CardTitle>
                <CardDescription>{t.auth.resetSubtitle}</CardDescription>
              </CardHeader>

              {formError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
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
                    className={frostedInputClass}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
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
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {t.auth.welcomeTitle}
                </CardTitle>
                <CardDescription>{t.auth.welcomeSubtitle}</CardDescription>
              </CardHeader>

              {formError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-[var(--strata-money-expense)] bg-[var(--strata-bg-canvas)]/75 px-3.5 py-2.5 text-xs font-medium text-[var(--strata-money-expense)]"
                >
                  {formError}
                </div>
              ) : null}

              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setFormError(null);
                  setConfirmPassword("");
                  setConfirmTouched(false);
                  setMode(v === "signup" ? "signup" : "signin");
                }}
              >
                <TabsList className="bg-[var(--strata-bg-canvas)]/60">
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
                        className={frostedInputClass}
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
                          className="cursor-pointer text-xs font-medium text-[var(--strata-text-secondary)] transition hover:text-[var(--strata-text-primary)]"
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
                          className={`${frostedInputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword ? t.auth.hidePassword : t.auth.showPassword
                          }
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
                      {loading || authVisualState === "entering" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
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
                        className={frostedInputClass}
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
                          enterKeyHint="next"
                          required
                          aria-describedby="signup-password-rules"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${frostedInputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword ? t.auth.hidePassword : t.auth.showPassword
                          }
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

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-confirm-password">
                        {t.auth.confirmPasswordLabel}
                      </Label>
                      <div className="relative">
                        <Input
                          ref={confirmRef}
                          id="signup-confirm-password"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          minLength={8}
                          enterKeyHint="done"
                          required
                          aria-invalid={passwordsMismatch ? "true" : "false"}
                          aria-describedby={passwordsMismatch ? confirmErrorId : undefined}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onBlur={() => setConfirmTouched(true)}
                          className={cn(
                            frostedInputClass,
                            "pr-12",
                            passwordsMismatch && "border-[var(--strata-money-expense)]"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword ? t.auth.hidePassword : t.auth.showPassword
                          }
                          className="absolute inset-y-0 right-0 flex min-w-11 cursor-pointer items-center justify-center text-[var(--strata-text-muted)] transition hover:text-[var(--strata-text-primary)]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {passwordsMismatch ? (
                        <p
                          id={confirmErrorId}
                          className="text-xs font-medium text-[var(--strata-money-expense)]"
                        >
                          {t.errors.passwordsMismatch}
                        </p>
                      ) : null}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading || authVisualState === "entering" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {loading ? t.common.loading : t.auth.signUpSubmit}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        {inviteOnlyEnabled ? (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--strata-text-secondary)]">
            <Lock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            <span>{t.common.inviteBadge}</span>
          </p>
        ) : null}
      </main>
    </div>
  );
}
