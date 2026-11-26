import type { AalLevel } from "@strata/api-contract";
import type { AppSupabaseClient, RequestAuthContext } from "@/lib/supabase/server";

export interface ProfileGateState {
  role: "user" | "admin";
  invite_redeemed_at: string | null;
  invite_required: boolean;
}

export interface AuthSecurityState {
  session_active: boolean;
  session_id: string | null;
  current_aal: AalLevel;
  mfa_enrolled: boolean;
  mfa_required: boolean;
}

export interface ApiEnv {
  Variables: {
    auth?: RequestAuthContext;
    authState?: AuthSecurityState;
    profileGate?: ProfileGateState;
  };
}

export interface ApiDependencies {
  resolveAuth: (request: Request) => Promise<RequestAuthContext | null>;
  getPublicClient: () => AppSupabaseClient | null;
  getServiceClient?: () => AppSupabaseClient | null;
}
