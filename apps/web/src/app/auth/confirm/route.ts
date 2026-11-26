import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSessionGate } from "@/lib/auth/session-gate";
import { createCookieSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (tokenHash && type) {
    const supabase = await createCookieSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (!error) {
        if (type === "recovery") {
          redirectTo.pathname = "/reset-password";
          return NextResponse.redirect(redirectTo);
        }

        const gate = await getServerSessionGate();
        if (gate.status === "needs_invite") {
          redirectTo.pathname = "/invite";
        } else if (gate.status === "needs_onboarding") {
          redirectTo.pathname = "/onboarding";
        } else {
          redirectTo.pathname = "/";
        }
        return NextResponse.redirect(redirectTo);
      }
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "confirm_failed");
  return NextResponse.redirect(redirectTo);
}
