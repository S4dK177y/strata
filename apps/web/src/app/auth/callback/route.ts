import { NextResponse, type NextRequest } from "next/server";
import { getServerSessionGate, sanitizeNextPath } from "@/lib/auth/session-gate";
import { createCookieSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const safeNext = sanitizeNextPath(searchParams.get("next"));

  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("code");
  redirectTo.searchParams.delete("sb_flow_id");
  redirectTo.searchParams.delete("next");

  if (code) {
    const supabase = await createCookieSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined
      );

      if (!error) {
        if (safeNext === "/reset-password") {
          redirectTo.pathname = "/reset-password";
          return NextResponse.redirect(redirectTo);
        }

        const gate = await getServerSessionGate();
        if (gate.status === "needs_mfa") {
          redirectTo.pathname = "/mfa-verify";
          if (safeNext !== "/") {
            redirectTo.searchParams.set("next", safeNext);
          }
        } else if (gate.status === "needs_invite") {
          redirectTo.pathname = "/invite";
        } else if (gate.status === "needs_onboarding") {
          redirectTo.pathname = "/onboarding";
        } else if (gate.status === "ready") {
          redirectTo.pathname = safeNext;
        } else if (gate.status === "session_revoked") {
          redirectTo.pathname = "/login";
          redirectTo.searchParams.set("reason", "session_revoked");
        } else {
          redirectTo.pathname = "/login";
          redirectTo.searchParams.set("error", "auth_callback_failed");
        }
        return NextResponse.redirect(redirectTo);
      }
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(redirectTo);
}
