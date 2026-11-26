import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface EphemeralUserOptions {
  role?: "user" | "admin";
  onboardingCompleted?: boolean;
  tourCompleted?: boolean;
  seedStarterData?: boolean;
}

export interface EphemeralUserContext {
  userId: string;
  email: string;
  password: string;
  accountId?: string;
  categoryId?: string;
}

export function getAdminSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createEphemeralUser(
  admin: SupabaseClient,
  opts: EphemeralUserOptions = {}
): Promise<EphemeralUserContext> {
  const role = opts.role ?? "user";
  const onboardingCompleted = opts.onboardingCompleted ?? true;
  const tourCompleted = opts.tourCompleted ?? false;
  const seedStarterData = opts.seedStarterData ?? true;

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${role}-${unique}@example.com`;
  const password = `StrataE2E!${unique}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${role}` },
  });

  if (createError || !created.user) {
    throw new Error(`Failed to create ephemeral E2E user: ${createError?.message ?? "unknown"}`);
  }

  const userId = created.user.id;
  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role,
      display_name: role === "admin" ? "E2E Admin" : "E2E User",
      locale: "ru",
      base_currency: "RUB",
      theme: "dark",
      accent: "emerald",
      invite_redeemed_at: now,
      onboarding_completed: onboardingCompleted,
      tour_completed_at: tourCompleted ? now : null,
    })
    .eq("id", userId);

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to configure ephemeral E2E profile: ${profileError.message}`);
  }

  let accountId: string | undefined;
  let categoryId: string | undefined;

  if (seedStarterData) {
    const { data: acc, error: accErr } = await admin
      .from("accounts")
      .insert({
        user_id: userId,
        name: "E2E Debit",
        type: "debit",
        currency: "RUB",
        initial_balance_minor: 1000000,
        credit_limit_minor: 0,
        is_active: true,
        sort_order: 0,
      })
      .select("id")
      .single();

    if (accErr) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to seed E2E account: ${accErr.message}`);
    }
    accountId = acc.id;

    const { data: cat, error: catErr } = await admin
      .from("categories")
      .insert({
        user_id: userId,
        name: "Продукты E2E",
        kind: "expense",
        is_passive: false,
        monthly_limit_minor: 500000,
        icon: "shopping-cart",
        sort_order: 0,
      })
      .select("id")
      .single();

    if (catErr) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to seed E2E category: ${catErr.message}`);
    }
    categoryId = cat.id;

    // Seed an income transaction so Cashflow & Savings Rate charts render meaningful data immediately
    await admin.from("transactions").insert({
      user_id: userId,
      occurred_at: now,
      type: "income",
      amount_minor: 5000000,
      account_from_id: accountId,
      comment: "E2E Salary",
      status: "confirmed",
      source: "web",
    });
  }

  return { userId, email, password, accountId, categoryId };
}

export async function deleteEphemeralUser(
  admin: SupabaseClient,
  userId: string | undefined
): Promise<void> {
  if (!userId) return;
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}
