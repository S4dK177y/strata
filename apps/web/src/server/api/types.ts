import type { AppSupabaseClient, RequestAuthContext } from "@/lib/supabase/server";

export interface ProfileGateState {
  role: "user" | "admin";
  invite_redeemed_at: string | null;
  invite_required: boolean;
}

export interface ApiEnv {
  Variables: {
    auth?: RequestAuthContext;
    profileGate?: ProfileGateState;
  };
}

export interface ApiDependencies {
  resolveAuth: (request: Request) => Promise<RequestAuthContext | null>;
  getPublicClient: () => AppSupabaseClient | null;
}
