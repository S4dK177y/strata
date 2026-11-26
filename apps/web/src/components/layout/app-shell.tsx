"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Compass,
  Eye,
  EyeOff,
  Globe,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Settings,
  Shield,
  Sun,
  User,
  Wallet,
} from "lucide-react";
import type { Account, Category, Debt, Goal, Profile } from "@strata/api-contract";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { SpotlightTourProvider } from "@/components/tour/spotlight-tour-provider";
import {
  QuickAddProvider,
  useQuickAdd,
} from "@/components/transactions/quick-add-provider";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { notifyRouteChanged, TransitionLink } from "./transition-link";

interface AppShellProps {
  profile: Profile;
  email: string | null;
  initialAccounts?: Account[];
  initialCategories?: Category[];
  initialGoals?: Goal[];
  initialDebts?: Debt[];
  children: ReactNode;
}

function ProfileQuickMenu({
  profile,
  email,
}: {
  profile: Profile;
  email: string | null;
}) {
  const { locale, setLocale, t } = useI18n();
  const { resolvedTheme, toggleCompactTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = (profile.display_name || email || "S").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.nav.accountMenu}
        title={profile.display_name || email || t.nav.accountMenu}
        className={cn(
          "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border text-xs font-bold transition",
          open
            ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)]"
            : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-primary)] hover:border-[var(--strata-border-strong)]"
        )}
      >
        {initial ? (
          <span>{initial}</span>
        ) : (
          <User className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="strata-frosted absolute right-0 mt-2 w-64 origin-top-right space-y-1.5 rounded-3xl p-2.5 shadow-2xl"
        >
          <div className="border-b border-[var(--strata-border-subtle)] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-[var(--strata-text-primary)]">
                {profile.display_name || t.common.brand}
              </span>
              {profile.role === "admin" ? (
                <Badge tone="brand">
                  <Shield className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  {t.common.adminBadge}
                </Badge>
              ) : null}
            </div>
            {email ? (
              <div className="truncate text-xs text-[var(--strata-text-muted)]">{email}</div>
            ) : null}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => setLocale(locale === "ru" ? "en" : "ru", { syncServer: true })}
            className="flex min-h-10 w-full cursor-pointer items-center justify-between rounded-2xl px-2.5 py-2 text-xs font-semibold text-[var(--strata-text-secondary)] transition hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              {t.locale.label}
            </span>
            <span className="strata-mono rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5 text-[11px] font-bold text-[var(--strata-text-primary)]">
              {locale.toUpperCase()}
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => toggleCompactTheme({ syncServer: true })}
            className="flex min-h-10 w-full cursor-pointer items-center justify-between rounded-2xl px-2.5 py-2 text-xs font-semibold text-[var(--strata-text-secondary)] transition hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
          >
            <span className="flex items-center gap-2">
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--strata-text-muted)]" strokeWidth={1.75} aria-hidden="true" />
              )}
              {t.theme.label}
            </span>
            <span className="rounded-lg bg-[var(--strata-bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--strata-text-primary)]">
              {resolvedTheme === "dark" ? t.theme.dark : t.theme.light}
            </span>
          </button>

          {profile.role === "admin" ? (
            <TransitionLink
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-xs font-semibold text-[var(--strata-accent-brand)] transition hover:bg-[var(--strata-bg-elevated)]"
            >
              <Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {t.nav.admin}
            </TransitionLink>
          ) : null}

          <div className="border-t border-[var(--strata-border-subtle)] pt-1.5">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-2xl px-2.5 py-2 text-xs font-semibold text-[var(--strata-money-expense)] transition hover:bg-[var(--strata-bg-elevated)]"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {t.common.signOut}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrivacyIconButton() {
  const { privacyBlur, togglePrivacyBlur } = usePrivacy();
  const { t } = useI18n();

  return (
    <button
      type="button"
      data-tour="privacy-toggle"
      onClick={togglePrivacyBlur}
      aria-pressed={privacyBlur}
      aria-label={t.privacy.label}
      title={t.privacy.label}
      className={cn(
        "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition",
        privacyBlur
          ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-brand)]"
          : "border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] text-[var(--strata-text-secondary)] hover:border-[var(--strata-border-strong)] hover:text-[var(--strata-text-primary)]"
      )}
    >
      {privacyBlur ? (
        <EyeOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}

function AppShellInner({
  profile,
  email,
  children,
}: {
  profile: Profile;
  email: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t, setLocale } = useI18n();
  const { setTheme, setAccent } = useTheme();
  const { setPrivacyBlur } = usePrivacy();
  const { openQuickAdd } = useQuickAdd();
  const hydratedProfileIdRef = useRef<string | null>(null);
  const prevPathnameRef = useRef<string>(pathname);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hydratedProfileIdRef.current === profile.id) return;
    hydratedProfileIdRef.current = profile.id;

    setTheme(profile.theme);
    setAccent(profile.accent);
    setLocale(profile.locale);
    setPrivacyBlur(profile.privacy_blur_default);
  }, [profile, setAccent, setLocale, setPrivacyBlur, setTheme]);

  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    notifyRouteChanged();
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const navItems = [
    { href: "/", label: t.nav.overview, icon: LayoutDashboard, active: pathname === "/", live: true },
    {
      href: "/operations",
      label: t.nav.operations,
      icon: ArrowLeftRight,
      active: pathname.startsWith("/operations"),
      live: true,
    },
    {
      href: "/capital",
      label: t.nav.capital,
      icon: Wallet,
      active: pathname.startsWith("/capital"),
      live: true,
    },
    { href: "#plans", label: t.nav.plans, icon: Compass, active: false, live: false },
    {
      href: "/settings",
      label: t.nav.settings,
      icon: Settings,
      active: pathname === "/settings",
      live: true,
    },
    ...(profile.role === "admin"
      ? [
          {
            href: "/admin",
            label: t.nav.admin,
            icon: Shield,
            active: pathname.startsWith("/admin"),
            live: true,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Desktop Floating Glass Top Capsule (Variant A) */}
      <header className="strata-vt-header sticky top-0 z-30 hidden px-4 pt-3 pb-2 lg:block lg:px-8">
        <div className="strata-frosted mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full px-3 py-1.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-full py-0.5 pl-1 pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt={t.common.brand} className="h-8 w-8 rounded-xl" />
            <span className="text-sm font-bold tracking-tight text-[var(--strata-text-primary)]">
              {t.common.brand}
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            data-tour="nav-sections"
            className="flex min-w-0 items-center gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              if (!item.live) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title={t.common.comingSoon}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[var(--strata-text-muted)] opacity-55"
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <TransitionLink
                  key={item.href}
                  href={item.href}
                  data-tour={item.href === "/settings" ? "settings-link" : undefined}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition",
                    item.active
                      ? "bg-[var(--strata-accent-brand)] text-[var(--strata-text-onAccent)] shadow-sm"
                      : "text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </TransitionLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-tour="quick-add"
              onClick={() => openQuickAdd()}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--strata-bg-elevated)] px-3.5 text-xs font-semibold text-[var(--strata-text-primary)] transition hover:brightness-110 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--strata-accent-brand)]" strokeWidth={2.25} aria-hidden="true" />
              <span>{t.nav.quickAdd}</span>
              <kbd className="strata-mono rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--strata-text-muted)] dark:bg-white/10">
                N
              </kbd>
            </button>

            <PrivacyIconButton />
            <ProfileQuickMenu profile={profile} email={email} />
          </div>
        </div>
      </header>

      {/* Mobile Minimal Top Bar */}
      <header className="strata-vt-header sticky top-0 z-30 border-b border-[var(--strata-border-subtle)] bg-[var(--strata-bg-glass)] px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt={t.common.brand} className="h-8 w-8 rounded-xl" />
            <span className="text-base font-bold text-[var(--strata-text-primary)]">
              {t.common.brand}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <PrivacyIconButton />
            <ProfileQuickMenu profile={profile} email={email} />
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="strata-main-stage mx-auto w-full max-w-5xl px-4 py-5 pb-28 focus:outline-none lg:px-8 lg:py-6 lg:pb-12"
      >
        {children}
      </main>

      {/* Mobile Floating Glass Bottom Dock (Variant A) */}
      <nav
        aria-label="Mobile navigation"
        data-tour="nav-sections"
        className="strata-vt-bottom-nav strata-frosted fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-md grid-cols-5 items-center rounded-[26px] px-1.5 py-1.5 shadow-2xl lg:hidden"
      >
        <TransitionLink
          href="/"
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold",
            pathname === "/"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.nav.overview}</span>
        </TransitionLink>

        <TransitionLink
          href="/operations"
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold",
            pathname.startsWith("/operations")
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.nav.operations}</span>
        </TransitionLink>

        <button
          type="button"
          data-tour="quick-add"
          onClick={() => openQuickAdd()}
          aria-label={t.nav.addOperation}
          title={t.nav.addOperation}
          className="mx-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[var(--strata-accent-brand)] text-[var(--strata-text-onAccent)] shadow-[var(--strata-shadow-neon)] transition hover:brightness-110 active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>

        <TransitionLink
          href="/capital"
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold",
            pathname.startsWith("/capital")
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <Wallet className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.nav.capital}</span>
        </TransitionLink>

        <TransitionLink
          href="/settings"
          data-tour="settings-link"
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold",
            pathname === "/settings"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.nav.settings}</span>
        </TransitionLink>
      </nav>
    </div>
  );
}

export function AppShell({
  profile,
  email,
  initialAccounts,
  initialCategories,
  initialGoals,
  initialDebts,
  children,
}: AppShellProps) {
  return (
    <QuickAddProvider
      baseCurrency={profile.base_currency}
      initialAccounts={initialAccounts}
      initialCategories={initialCategories}
      initialGoals={initialGoals}
      initialDebts={initialDebts}
    >
      <SpotlightTourProvider profile={profile}>
        <AppShellInner profile={profile} email={email}>
          {children}
        </AppShellInner>
      </SpotlightTourProvider>
    </QuickAddProvider>
  );
}
