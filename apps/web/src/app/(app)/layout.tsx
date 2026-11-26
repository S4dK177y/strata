import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Account, Category, Debt } from "@strata/api-contract";
import { AppShell } from "@/components/layout/app-shell";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const gate = await getServerSessionGate();

  if (gate.status === "session_revoked") redirect("/login?reason=session_revoked");
  if (gate.status === "unauthenticated") redirect("/login");
  if (gate.status === "needs_mfa") redirect("/mfa-verify");
  if (gate.status === "needs_invite") redirect("/invite");
  if (gate.status === "needs_onboarding") redirect("/onboarding");

  const [accountsRes, categoriesRes, debtsRes] = await Promise.all([
    gate.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", gate.userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("categories")
      .select("*")
      .eq("user_id", gate.userId)
      .is("deleted_at", null)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    gate.supabase
      .from("debts")
      .select("*")
      .eq("user_id", gate.userId)
      .is("deleted_at", null),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const debts = (debtsRes.data ?? []) as Debt[];

  return (
    <AppShell
      profile={gate.profile}
      email={gate.email}
      initialAccounts={accounts}
      initialCategories={categories}
      initialDebts={debts}
    >
      {children}
    </AppShell>
  );
}
