import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
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
  if (gate.status === "needs_invite") {
    redirect("/invite");
  }
  if (gate.status === "ready") {
    redirect("/");
  }

  return <OnboardingWizard initialProfile={gate.profile} email={gate.email} />;
}
