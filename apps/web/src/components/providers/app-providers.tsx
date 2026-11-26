"use client";

import type { ReactNode } from "react";
import type { Locale } from "@strata/api-contract";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { AuthTransitionProvider } from "./auth-transition-provider";
import { PrivacyProvider } from "./privacy-provider";
import { ThemeProvider, useTheme } from "./theme-provider";

function StrataToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--strata-bg-elevated)",
          color: "var(--strata-text-primary)",
          border: "1px solid var(--strata-border-strong)",
          borderRadius: "var(--strata-radius-card)",
        },
      }}
    />
  );
}

export function AppProviders({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <ThemeProvider>
        <PrivacyProvider>
          <AuthTransitionProvider>
            {children}
            <StrataToaster />
          </AuthTransitionProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
