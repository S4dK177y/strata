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
import type { AccentPalette, Theme } from "@strata/api-contract";

const THEME_STORAGE_KEY = "strata-theme";
const ACCENT_STORAGE_KEY = "strata-accent";

export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  accent: AccentPalette;
  systemTheme: ResolvedTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme, opts?: { syncServer?: boolean }) => void;
  setAccent: (next: AccentPalette, opts?: { syncServer?: boolean }) => void;
  toggleCompactTheme: (opts?: { syncServer?: boolean }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidAccent(val: string | null): val is AccentPalette {
  return (
    val === "emerald" ||
    val === "ocean" ||
    val === "amethyst" ||
    val === "sunset" ||
    val === "graphite"
  );
}

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

function readStoredAccent(): AccentPalette {
  if (typeof window === "undefined") return "emerald";
  try {
    const val = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isValidAccent(val)) return val;
  } catch {
    // Ignore storage access errors
  }
  return "emerald";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeToDom(theme: Theme, systemTheme: ResolvedTheme, accent: AccentPalette) {
  if (typeof document === "undefined") return;
  const resolved: ResolvedTheme = theme === "system" ? systemTheme : theme;

  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", theme === "system" ? "light dark" : theme);
  }

  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  themeMetas.forEach((el) => {
    if (theme === "system") {
      const media = el.getAttribute("media") ?? "";
      if (media.includes("light")) {
        el.setAttribute("content", "#F2F4F7");
      } else {
        el.setAttribute("content", "#0B0C0E");
      }
    } else {
      el.setAttribute("content", resolved === "dark" ? "#0B0C0E" : "#F2F4F7");
    }
  });

  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.dataset.accent = accent;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [accent, setAccentState] = useState<AccentPalette>(() => readStoredAccent());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    applyThemeToDom(theme, systemTheme, accent);
  }, [theme, systemTheme, accent]);

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
      } else if (event.key === ACCENT_STORAGE_KEY) {
        setAccentState(isValidAccent(event.newValue) ? event.newValue : "emerald");
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
      applyThemeToDom(next, getSystemTheme(), readStoredAccent());

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

  const setAccent = useCallback(
    (next: AccentPalette, opts?: { syncServer?: boolean }) => {
      setAccentState(next);
      try {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      if (typeof document !== "undefined") {
        document.documentElement.dataset.accent = next;
      }

      if (opts?.syncServer) {
        void fetch("/api/v1/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accent: next }),
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
      const nextTheme: Theme = target === currentSys ? "system" : target;
      setTheme(nextTheme, opts);
    },
    [theme, setTheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      accent,
      systemTheme,
      resolvedTheme,
      setTheme,
      setAccent,
      toggleCompactTheme,
    }),
    [theme, accent, systemTheme, resolvedTheme, setTheme, setAccent, toggleCompactTheme]
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
