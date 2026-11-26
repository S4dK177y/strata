import { redirect } from "next/navigation";
import { MfaVerifyCard } from "@/components/auth/mfa-verify-card";
import { getServerSessionGate, sanitizeNextPath } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const safeNext = sanitizeNextPath(params.next);
  const gate = await getServerSessionGate();

  if (gate.status === "session_revoked") {
    redirect("/login?reason=session_revoked");
  }
  if (gate.status === "unauthenticated") {
    redirect("/login");
  }
  if (gate.status === "needs_invite") {
    redirect("/invite");
  }
  if (gate.status === "needs_onboarding") {
    redirect("/onboarding");
  }
  if (gate.status === "ready") {
    redirect(safeNext);
  }

  return <MfaVerifyCard email={gate.email} safeNext={safeNext} />;
}
