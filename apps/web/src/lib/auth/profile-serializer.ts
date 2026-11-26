import {
  AccentPaletteSchema,
  WrappedSettingsSchema,
  type AccentPalette,
  type Profile,
} from "@strata/api-contract";
import type { Database } from "@/lib/supabase/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const PROFILE_SELECT_COLUMNS =
  "id, role, display_name, locale, base_currency, theme, accent, privacy_blur_default, onboarding_completed, invite_redeemed_at, tour_completed_at, wrapped_settings, created_at, updated_at" as const;

export function serializeProfileRow(row: ProfileRow): Profile {
  const role: "admin" | "user" = row.role === "admin" ? "admin" : "user";
  const theme: "light" | "dark" | "system" =
    row.theme === "light" || row.theme === "dark" ? row.theme : "system";
  const accentParsed = AccentPaletteSchema.safeParse(row.accent);
  const accent: AccentPalette = accentParsed.success ? accentParsed.data : "emerald";
  const locale: "ru" | "en" = row.locale === "en" ? "en" : "ru";
  const wrappedParsed = WrappedSettingsSchema.safeParse(row.wrapped_settings ?? {});

  return {
    id: row.id,
    role,
    display_name: row.display_name,
    locale,
    base_currency: row.base_currency,
    theme,
    accent,
    privacy_blur_default: row.privacy_blur_default,
    onboarding_completed: row.onboarding_completed,
    invite_redeemed_at: row.invite_redeemed_at,
    tour_completed_at: row.tour_completed_at ?? null,
    wrapped_settings: wrappedParsed.success
      ? wrappedParsed.data
      : WrappedSettingsSchema.parse({}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function computeInviteRequired(
  inviteOnlyEnabled: boolean,
  profile: Pick<Profile, "role" | "invite_redeemed_at">
): boolean {
  return inviteOnlyEnabled && profile.role !== "admin" && profile.invite_redeemed_at === null;
}
