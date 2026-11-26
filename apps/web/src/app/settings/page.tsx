import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsClient } from "@/components/settings/settings-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const gate = await getServerSessionGate();

  if (gate.status === "unauthenticated") {
    redirect("/login");
  }
  if (gate.status === "needs_invite") {
    redirect("/invite");
  }
  if (gate.status === "needs_onboarding") {
    redirect("/onboarding");
  }

  return (
    <AppShell profile={gate.profile} email={gate.email}>
      <SettingsClient profile={gate.profile} email={gate.email} />
    </AppShell>
  );
}
