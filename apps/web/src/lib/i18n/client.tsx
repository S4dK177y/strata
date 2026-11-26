"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "@strata/api-contract";
import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import type { Messages } from "./types";

const LOCALE_COOKIE = "strata-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale, opts?: { syncServer?: boolean }) => void;
  t: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale, opts?: { syncServer?: boolean }) => {
      setLocaleState(next);
      document.documentElement.lang = next;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;

      if (opts?.syncServer) {
        void fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        }).catch(() => {});
      }
    },
    []
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: locale === "en" ? enMessages : ruMessages,
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
