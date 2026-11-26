import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const gate = await getServerSessionGate();

  if (gate.status === "session_revoked") {
    redirect("/login?reason=session_revoked");
  }
  if (gate.status === "needs_mfa") {
    redirect("/mfa-verify?next=/settings");
  }
  if (gate.status !== "ready") {
    redirect("/login");
  }

  return (
    <div className="strata-page-enter">
      <SettingsClient
        profile={gate.profile}
        email={gate.email}
        initialMfaEnabled={gate.mfaEnabled}
        initialAal={gate.aal}
      />
    </div>
  );
}
