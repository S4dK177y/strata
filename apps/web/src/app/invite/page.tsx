import { redirect } from "next/navigation";
import { InviteGateCard } from "@/components/auth/invite-gate-card";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const gate = await getServerSessionGate();

  if (gate.status === "session_revoked") {
    redirect("/login?reason=session_revoked");
  }
  if (gate.status === "unauthenticated") {
    redirect("/login");
  }
  if (gate.status === "needs_mfa") {
    redirect("/mfa-verify");
  }
  if (gate.status === "needs_onboarding") {
    redirect("/onboarding");
  }
  if (gate.status === "ready") {
    redirect("/");
  }

  return <InviteGateCard email={gate.email} />;
}
