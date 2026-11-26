"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Compass,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Shield,
  Wallet,
} from "lucide-react";
import type { Account, Category, Debt, Goal, Profile } from "@strata/api-contract";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { useTheme } from "@/components/providers/theme-provider";
import {
  QuickAddProvider,
  useQuickAdd,
} from "@/components/transactions/quick-add-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface AppShellProps {
  profile: Profile;
  email: string | null;
  initialAccounts?: Account[];
  initialCategories?: Category[];
  initialGoals?: Goal[];
  initialDebts?: Debt[];
  children: ReactNode;
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
  const { setTheme } = useTheme();
  const { setPrivacyBlur } = usePrivacy();
  const { openQuickAdd } = useQuickAdd();
  const hydratedProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (hydratedProfileIdRef.current === profile.id) return;
    hydratedProfileIdRef.current = profile.id;

    setTheme(profile.theme);
    setLocale(profile.locale);
    setPrivacyBlur(profile.privacy_blur_default);
  }, [profile, setLocale, setPrivacyBlur, setTheme]);

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
  ];

  return (
    <div className="min-h-screen overflow-x-clip lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-y-auto lg:border-r lg:border-[var(--strata-border-subtle)] lg:bg-[var(--strata-bg-surface)] lg:p-5">
        <div className="space-y-5">
          <Link href="/" className="flex items-center gap-3 rounded-2xl p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt={t.common.brand} className="h-9 w-9 rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-[var(--strata-text-primary)]">
                  {t.common.brand}
                </span>
                {profile.role === "admin" ? (
                  <Badge tone="brand">
                    <Shield className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    {t.common.adminBadge}
                  </Badge>
                ) : null}
              </div>
              <span className="block max-w-[160px] truncate text-xs text-[var(--strata-text-muted)]">
                {profile.display_name || email || t.common.brand}
              </span>
            </div>
          </Link>

          <Button
            type="button"
            onClick={() => openQuickAdd()}
            className="w-full justify-center shadow-[var(--strata-shadow-neon)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span>{t.nav.addOperation}</span>
            <kbd className="strata-mono ml-auto rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold">
              N
            </kbd>
          </Button>

          <nav aria-label="Main navigation" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (!item.live) {
                return (
                  <div
                    key={item.href}
                    aria-disabled="true"
                    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-[var(--strata-text-muted)] opacity-55"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="strata-mono text-[10px] font-medium uppercase tracking-wider">
                      PR5
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition",
                    item.active
                      ? "bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-brand)]"
                      : "text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] px-3.5 py-2.5 text-sm font-medium text-[var(--strata-text-secondary)] transition hover:text-[var(--strata-text-primary)]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {t.common.signOut}
          </button>
        </form>
      </aside>

      {/* Main area */}
      <div className="min-w-0 flex-1 pb-28 lg:pb-10">
        <header className="sticky top-0 z-30 border-b border-[var(--strata-border-subtle)] bg-[var(--strata-bg-glass)] px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt={t.common.brand} className="h-8 w-8 rounded-lg" />
              <span className="text-base font-bold text-[var(--strata-text-primary)]">
                {t.common.brand}
              </span>
            </Link>

            <div className="hidden text-sm font-medium text-[var(--strata-text-secondary)] lg:block">
              {profile.display_name || email}
            </div>

            <div className="flex items-center gap-2">
              <PrivacyToggle />
              <LocaleSwitcher syncServer />
              <ThemeSwitcher variant="compact" syncServer />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6 lg:px-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:hidden"
      >
        <Link
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
        </Link>

        <Link
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
        </Link>

        <button
          type="button"
          onClick={() => openQuickAdd()}
          aria-label={t.nav.addOperation}
          title={t.nav.addOperation}
          className="mx-auto flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-[var(--strata-accent-brand)] text-[var(--strata-text-onAccent)] shadow-[var(--strata-shadow-neon)] transition hover:brightness-110 active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>

        <Link
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
        </Link>

        <Link
          href="/settings"
          className={cn(
            "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] font-semibold",
            pathname === "/settings"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="max-w-full truncate">{t.nav.settings}</span>
        </Link>
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
      <AppShellInner profile={profile} email={email}>
        {children}
      </AppShellInner>
    </QuickAddProvider>
  );
}
