import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers/app-providers";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-strata-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-strata-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Strata — Personal Finance",
  description: "Open-source privacy-first personal finance, goals & seasonal Wrapped PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Strata",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C0E" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("strata-theme");var m=document.querySelector('meta[name="color-scheme"]');var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(m){m.content=(t==="light"||t==="dark")?t:"light dark";}var r=document.documentElement;r.classList.toggle("dark",d);r.classList.toggle("light",!d);if(t==="light"||t==="dark"){var tc=d?"#0B0C0E":"#F2F4F7";document.querySelectorAll('meta[name="theme-color"]').forEach(function(el){el.setAttribute("content",tc);});}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialLocale = await getServerLocale();

  return (
    <html
      lang={initialLocale}
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <AppProviders initialLocale={initialLocale}>{children}</AppProviders>
      </body>
    </html>
  );
}
