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
import type { Theme } from "@strata/api-contract";

const THEME_STORAGE_KEY = "strata-theme";

export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  systemTheme: ResolvedTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme, opts?: { syncServer?: boolean }) => void;
  toggleCompactTheme: (opts?: { syncServer?: boolean }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const val = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "dark") return val;
  } catch {
    // Ignore storage access errors
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDom(theme: Theme, systemTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const resolved: ResolvedTheme = theme === "system" ? systemTheme : theme;

  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", theme === "system" ? "light dark" : theme);
  }

  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyThemeToDom(theme, systemTheme);
  }, [theme, systemTheme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setThemeState(
          event.newValue === "light" || event.newValue === "dark"
            ? event.newValue
            : "system"
        );
      }
    };

    mq.addEventListener("change", handleMediaChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      mq.removeEventListener("change", handleMediaChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = useCallback(
    (next: Theme, opts?: { syncServer?: boolean }) => {
      setThemeState(next);
      try {
        if (next === "system") {
          window.localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
      } catch {
        // Ignore storage errors
      }
      applyThemeToDom(next, getSystemTheme());

      if (opts?.syncServer) {
        void fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: next }),
        }).catch(() => {});
      }
    },
    []
  );

  const toggleCompactTheme = useCallback(
    (opts?: { syncServer?: boolean }) => {
      const currentSys = getSystemTheme();
      const currentlyRendered: ResolvedTheme = theme === "system" ? currentSys : theme;
      const target: ResolvedTheme = currentlyRendered === "dark" ? "light" : "dark";
      // If target matches OS preference, revert to "system" instead of pinning
      const nextTheme: Theme = target === currentSys ? "system" : target;
      setTheme(nextTheme, opts);
    },
    [theme, setTheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      systemTheme,
      resolvedTheme,
      setTheme,
      toggleCompactTheme,
    }),
    [theme, systemTheme, resolvedTheme, setTheme, toggleCompactTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
