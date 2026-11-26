import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { getServerSessionGate, sanitizeNextPath } from "@/lib/auth/session-gate";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const safeNext = sanitizeNextPath(params.next);
  const gate = await getServerSessionGate();

  if (gate.status === "needs_mfa") {
    const query = safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : "";
    redirect(`/mfa-verify${query}`);
  }
  if (gate.status === "needs_invite") {
    redirect("/invite");
  }
  if (gate.status === "needs_onboarding") {
    redirect("/onboarding");
  }
  if (gate.status === "ready") {
    redirect("/");
  }

  let inviteOnlyEnabled = true;
  const publicClient = createPublicSupabaseClient();
  if (publicClient) {
    const { data } = await publicClient
      .from("feature_flags")
      .select("enabled")
      .eq("key", "registration_invite_only")
      .maybeSingle();
    if (data) {
      inviteOnlyEnabled = data.enabled;
    }
  }

  const effectiveReason =
    gate.status === "session_revoked" ? "session_revoked" : (params.reason ?? null);

  return (
    <AuthCard
      safeNext={safeNext}
      initialError={params.error ?? null}
      reason={effectiveReason}
      deleted={params.deleted === "1"}
      inviteOnlyEnabled={inviteOnlyEnabled}
    />
  );
}
