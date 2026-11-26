import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  return (
    <div className="strata-page-enter">
      <SettingsClient profile={gate.profile} email={gate.email} />
    </div>
  );
}
