import { cookies, headers } from "next/headers";
import type { Locale } from "@strata/api-contract";

export const LOCALE_COOKIE = "strata-locale";

export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (cookieLocale === "en" || cookieLocale === "ru") {
      return cookieLocale;
    }

    const headerList = await headers();
    const acceptLanguage = headerList.get("accept-language")?.toLowerCase() ?? "";
    if (acceptLanguage.startsWith("en") || acceptLanguage.includes(",en")) {
      return "en";
    }
  } catch {
    // Fallback for static or test contexts
  }
  return "ru";
}
