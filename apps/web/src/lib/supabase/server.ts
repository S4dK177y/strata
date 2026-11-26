import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export type AppSupabaseClient = SupabaseClient<Database>;

export interface RequestAuthContext {
  supabase: AppSupabaseClient;
  userId: string;
  email: string | null;
  authMode: "bearer" | "cookie";
  sessionId: string | null;
  aal: "aal1" | "aal2" | null;
}

export function createPublicSupabaseClient(): AppSupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient<Database>(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createBearerSupabaseClient(accessToken: string): AppSupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient<Database>(env.url, env.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function createCookieSupabaseClient(): Promise<AppSupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Route handlers that don't mutate cookies can safely ignore this.
        }
      },
    },
  });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function extractClaimString(claims: Record<string, unknown>, key: string): string | null {
  const val = claims[key];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function extractAalClaim(claims: Record<string, unknown>): "aal1" | "aal2" | null {
  const raw = extractClaimString(claims, "aal");
  if (raw === "aal1" || raw === "aal2") return raw;
  return null;
}

export async function resolveRequestAuth(request: Request): Promise<RequestAuthContext | null> {
  const bearerToken = extractBearerToken(request);

  if (bearerToken) {
    const supabase = createBearerSupabaseClient(bearerToken);
    if (!supabase) return null;

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(bearerToken);
    if (!claimsError && claimsData?.claims?.sub) {
      const claims = claimsData.claims as Record<string, unknown>;
      return {
        supabase,
        userId: claimsData.claims.sub,
        email: typeof claimsData.claims.email === "string" ? claimsData.claims.email : null,
        authMode: "bearer",
        sessionId: extractClaimString(claims, "session_id"),
        aal: extractAalClaim(claims),
      };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(bearerToken);
    if (!userError && userData.user) {
      return {
        supabase,
        userId: userData.user.id,
        email: userData.user.email ?? null,
        authMode: "bearer",
        sessionId: null,
        aal: null,
      };
    }

    return null;
  }

  let cookieClient: AppSupabaseClient | null = null;
  try {
    cookieClient = await createCookieSupabaseClient();
  } catch {
    return null;
  }
  if (!cookieClient) return null;

  const { data: claimsData, error: claimsError } = await cookieClient.auth.getClaims();
  if (!claimsError && claimsData?.claims?.sub) {
    const claims = claimsData.claims as Record<string, unknown>;
    return {
      supabase: cookieClient,
      userId: claimsData.claims.sub,
      email: typeof claimsData.claims.email === "string" ? claimsData.claims.email : null,
      authMode: "cookie",
      sessionId: extractClaimString(claims, "session_id"),
      aal: extractAalClaim(claims),
    };
  }

  const { data: userData, error: userError } = await cookieClient.auth.getUser();
  if (!userError && userData.user) {
    return {
      supabase: cookieClient,
      userId: userData.user.id,
      email: userData.user.email ?? null,
      authMode: "cookie",
      sessionId: null,
      aal: null,
    };
  }

  return null;
}
