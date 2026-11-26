import { cache } from "react";
import type { Profile } from "@strata/api-contract";
import { createCookieSupabaseClient, type AppSupabaseClient } from "@/lib/supabase/server";
import { maybeBootstrapAdmin } from "./bootstrap-admin";
import {
  computeInviteRequired,
  PROFILE_SELECT_COLUMNS,
  serializeProfileRow,
} from "./profile-serializer";

export type ServerSessionGate =
  | { status: "unauthenticated" }
  | {
      status: "needs_invite";
      userId: string;
      email: string | null;
      profile: Profile;
      supabase: AppSupabaseClient;
    }
  | {
      status: "needs_onboarding";
      userId: string;
      email: string | null;
      profile: Profile;
      supabase: AppSupabaseClient;
    }
  | {
      status: "ready";
      userId: string;
      email: string | null;
      profile: Profile;
      supabase: AppSupabaseClient;
    };

export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  if (trimmed.startsWith("/auth/") || trimmed.startsWith("/login")) {
    return "/";
  }
  return trimmed;
}

export const getServerSessionGate = cache(async (): Promise<ServerSessionGate> => {
  let supabase: AppSupabaseClient | null = null;
  try {
    supabase = await createCookieSupabaseClient();
  } catch {
    return { status: "unauthenticated" };
  }
  if (!supabase) {
    return { status: "unauthenticated" };
  }

  let userId: string | null = null;
  let email: string | null = null;

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (!claimsError && claimsData?.claims?.sub) {
    userId = claimsData.claims.sub;
    email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;
  } else {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) {
      userId = userData.user.id;
      email = userData.user.email ?? null;
    }
  }

  if (!userId) {
    return { status: "unauthenticated" };
  }

  const [profileRes, flagRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "registration_invite_only")
      .maybeSingle(),
  ]);

  if (profileRes.error || !profileRes.data) {
    return { status: "unauthenticated" };
  }

  let profile = serializeProfileRow(profileRes.data);
  if (profile.role !== "admin") {
    const promoted = await maybeBootstrapAdmin({ userId, email });
    if (promoted) {
      profile = { ...profile, role: "admin" };
    }
  }

  const inviteOnlyEnabled = flagRes.data?.enabled ?? true;
  const inviteRequired = computeInviteRequired(inviteOnlyEnabled, profile);

  if (inviteRequired) {
    return { status: "needs_invite", userId, email, profile, supabase };
  }

  if (!profile.onboarding_completed) {
    return { status: "needs_onboarding", userId, email, profile, supabase };
  }

  return { status: "ready", userId, email, profile, supabase };
});
