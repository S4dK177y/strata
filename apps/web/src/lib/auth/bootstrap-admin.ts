import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

interface BootstrapAdminParams {
  userId: string;
  email: string | null;
}

export async function maybeBootstrapAdmin({
  userId,
  email,
}: BootstrapAdminParams): Promise<boolean> {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();

  if (!bootstrapEmail || !email) {
    return false;
  }

  if (email.trim().toLowerCase() !== bootstrapEmail) {
    return false;
  }

  try {
    const serviceClient = createServiceRoleSupabaseClient();
    if (!serviceClient) {
      return false;
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile || profile.role === "admin") {
      return false;
    }

    const { data: authUser, error: authError } = await serviceClient.auth.admin.getUserById(userId);
    if (authError || !authUser.user) {
      return false;
    }

    const isEmailConfirmed = Boolean(
      authUser.user.email_confirmed_at ?? authUser.user.confirmed_at
    );
    const verifiedEmail = authUser.user.email?.trim().toLowerCase();
    if (!isEmailConfirmed || verifiedEmail !== bootstrapEmail) {
      return false;
    }

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", userId);

    if (updateError) {
      console.warn("[strata-auth] failed to bootstrap admin role:", updateError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[strata-auth] unexpected error in maybeBootstrapAdmin:", err);
    return false;
  }
}
