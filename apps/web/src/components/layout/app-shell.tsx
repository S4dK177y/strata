"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { LiquidNavIndicator } from "./liquid-nav-indicator";
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
  showAdminLink = true,
}: {
  profile: Profile;
  email: string | null;
  showAdminLink?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();
  const { resolvedTheme, toggleCompactTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: Math.round(rect.bottom + 8),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: Math.round(rect.bottom + 8),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
    }
    setOpen(true);
  }

  const initial = (profile.display_name || email || "S").trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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

      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
              className="strata-frosted-menu fixed z-[60] w-64 origin-top-right space-y-1.5 rounded-3xl p-2.5"
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

              {showAdminLink && profile.role === "admin" ? (
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
            </div>,
            document.body
          )
        : null}
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
  const { isOpen: isQuickAddOpen, openQuickAdd } = useQuickAdd();
  const hydratedProfileIdRef = useRef<string | null>(null);
  const prevPathnameRef = useRef<string>(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [fabPulsing, setFabPulsing] = useState(false);
  const fabPulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fabPulseTimerRef.current !== null) {
        window.clearTimeout(fabPulseTimerRef.current);
      }
    };
  }, []);

  function handleQuickAddPress() {
    setFabPulsing(true);
    if (fabPulseTimerRef.current !== null) {
      window.clearTimeout(fabPulseTimerRef.current);
    }
    fabPulseTimerRef.current = window.setTimeout(() => {
      setFabPulsing(false);
    }, 450);
    openQuickAdd();
  }

  useEffect(() => {
    if (hydratedProfileIdRef.current === profile.id) return;
    hydratedProfileIdRef.current = profile.id;

    setTheme(profile.theme);
    setAccent(profile.accent);
    setLocale(profile.locale);
    setPrivacyBlur(profile.privacy_blur_default);
  }, [profile, setAccent, setLocale, setPrivacyBlur, setTheme]);

  useEffect(() => {
    const resetId = window.setTimeout(() => setPendingHref(null), 0);
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      notifyRouteChanged();
      mainRef.current?.focus({ preventScroll: true });
    }
    return () => window.clearTimeout(resetId);
  }, [pathname]);

  const effectivePath = pendingHref ?? pathname;

  const navItems = [
    { href: "/", label: t.nav.overview, icon: LayoutDashboard, active: effectivePath === "/", live: true },
    {
      href: "/operations",
      label: t.nav.operations,
      icon: ArrowLeftRight,
      active: effectivePath.startsWith("/operations"),
      live: true,
    },
    {
      href: "/capital",
      label: t.nav.capital,
      icon: Wallet,
      active: effectivePath.startsWith("/capital"),
      live: true,
    },
    { href: "#plans", label: t.nav.plans, icon: Compass, active: false, live: false },
    {
      href: "/settings",
      label: t.nav.settings,
      icon: Settings,
      active: effectivePath === "/settings",
      live: true,
    },
    ...(profile.role === "admin"
      ? [
          {
            href: "/admin",
            label: t.nav.admin,
            icon: Shield,
            active: effectivePath.startsWith("/admin"),
            live: true,
          },
        ]
      : []),
  ];

  const activeDesktopKey = navItems.find((item) => item.live && item.active)?.href ?? null;
  const activeMobileKey =
    effectivePath === "/"
      ? "/"
      : effectivePath.startsWith("/operations")
        ? "/operations"
        : effectivePath.startsWith("/capital")
          ? "/capital"
          : effectivePath === "/settings"
            ? "/settings"
            : null;

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Desktop Floating Glass Top Capsule (Variant A) */}
      <header className="strata-vt-header sticky top-0 z-30 hidden px-4 pt-3.5 pb-2.5 lg:block lg:px-8">
        <div className="strata-frosted mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-4 py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-full py-0.5 pl-1 pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt={t.common.brand} className="h-9 w-9 rounded-xl" />
            <span className="text-[15px] font-bold tracking-tight text-[var(--strata-text-primary)]">
              {t.common.brand}
            </span>
          </Link>

          <nav
            ref={desktopNavRef}
            aria-label="Main navigation"
            data-tour="nav-sections"
            className="strata-liquid-nav relative flex min-w-0 items-center gap-1"
          >
            <LiquidNavIndicator
              containerRef={desktopNavRef}
              activeKey={activeDesktopKey}
              variant="desktop"
            />
            {navItems.map((item) => {
              const Icon = item.icon;
              if (!item.live) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title={t.common.comingSoon}
                    className="relative z-10 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-[var(--strata-text-muted)] opacity-55"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <TransitionLink
                  key={item.href}
                  href={item.href}
                  data-nav-key={item.href}
                  data-active={item.active ? "true" : "false"}
                  data-tour={item.href === "/settings" ? "settings-link" : undefined}
                  onClick={() => {
                    if (item.href !== pathname) {
                      setPendingHref(item.href);
                    }
                  }}
                  className={cn(
                    "strata-liquid-item relative z-10 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors duration-200",
                    item.active
                      ? "text-[var(--strata-text-onAccent)]"
                      : "text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)]/70 hover:text-[var(--strata-text-primary)]"
                  )}
                >
                  <Icon
                    className="h-4 w-4"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </TransitionLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-tour="quick-add"
              onClick={handleQuickAddPress}
              className="group inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--strata-border-strong)] bg-[var(--strata-bg-elevated)]/90 pl-1.5 pr-3.5 text-[13px] font-semibold text-[var(--strata-text-primary)] shadow-xs transition duration-200 hover:border-[var(--strata-accent-brand)]/55 hover:brightness-105 active:scale-[0.96]"
            >
              <span className="strata-fab-badge flex h-7 w-7 items-center justify-center rounded-full text-[var(--strata-text-onAccent)]">
                <Plus
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-90",
                    isQuickAddOpen && "rotate-45"
                  )}
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              </span>
              <span>{t.nav.quickAdd}</span>
              <kbd className="strata-mono rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--strata-text-muted)] dark:bg-white/10">
                N
              </kbd>
            </button>

            <PrivacyIconButton />
            <ProfileQuickMenu profile={profile} email={email} showAdminLink={false} />
          </div>
        </div>
      </header>

      {/* Mobile Minimal Top Bar */}
      <header className="strata-vt-header strata-frosted-bar sticky top-0 z-30 border-b border-[var(--strata-border-subtle)] px-4 py-2.5 lg:hidden">
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
            <ProfileQuickMenu profile={profile} email={email} showAdminLink />
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
        ref={mobileNavRef}
        aria-label="Mobile navigation"
        data-tour="nav-sections"
        className="strata-vt-bottom-nav strata-frosted strata-liquid-nav fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-40 mx-auto grid max-w-md grid-cols-5 items-center rounded-[26px] px-1.5 py-1.5 shadow-2xl lg:hidden"
      >
        <LiquidNavIndicator
          containerRef={mobileNavRef}
          activeKey={activeMobileKey}
          variant="mobile"
        />

        <TransitionLink
          href="/"
          data-nav-key="/"
          data-active={activeMobileKey === "/" ? "true" : "false"}
          onClick={() => {
            if (pathname !== "/") setPendingHref("/");
          }}
          className={cn(
            "strata-liquid-item relative z-10 flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
            activeMobileKey === "/"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <LayoutDashboard
            className="h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="max-w-full truncate">{t.nav.overview}</span>
        </TransitionLink>

        <TransitionLink
          href="/operations"
          data-nav-key="/operations"
          data-active={activeMobileKey === "/operations" ? "true" : "false"}
          onClick={() => {
            if (!pathname.startsWith("/operations")) setPendingHref("/operations");
          }}
          className={cn(
            "strata-liquid-item relative z-10 flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
            activeMobileKey === "/operations"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <ArrowLeftRight
            className="h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="max-w-full truncate">{t.nav.operations}</span>
        </TransitionLink>

        <button
          type="button"
          data-tour="quick-add"
          data-pulsing={fabPulsing ? "true" : "false"}
          data-open={isQuickAddOpen ? "true" : "false"}
          onClick={handleQuickAddPress}
          aria-label={t.nav.addOperation}
          title={t.nav.addOperation}
          className="strata-fab-plus relative z-20 mx-auto flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-[18px] text-[var(--strata-text-onAccent)]"
        >
          <Plus
            className={cn(
              "relative z-10 h-5 w-5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isQuickAddOpen && "rotate-45"
            )}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>

        <TransitionLink
          href="/capital"
          data-nav-key="/capital"
          data-active={activeMobileKey === "/capital" ? "true" : "false"}
          onClick={() => {
            if (!pathname.startsWith("/capital")) setPendingHref("/capital");
          }}
          className={cn(
            "strata-liquid-item relative z-10 flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
            activeMobileKey === "/capital"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <Wallet
            className="h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="max-w-full truncate">{t.nav.capital}</span>
        </TransitionLink>

        <TransitionLink
          href="/settings"
          data-nav-key="/settings"
          data-active={activeMobileKey === "/settings" ? "true" : "false"}
          data-tour="settings-link"
          onClick={() => {
            if (pathname !== "/settings") setPendingHref("/settings");
          }}
          className={cn(
            "strata-liquid-item relative z-10 flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
            activeMobileKey === "/settings"
              ? "text-[var(--strata-accent-brand)]"
              : "text-[var(--strata-text-muted)]"
          )}
        >
          <Settings
            className="h-4 w-4 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
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
