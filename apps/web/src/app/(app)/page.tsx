import { redirect } from "next/navigation";
import type { Account, Category, Debt, Transaction } from "@strata/api-contract";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  const now = new Date();

  const [accountsRes, categoriesRes, debtsRes, txRes] = await Promise.all([
    gate.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("categories")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    gate.supabase
      .from("debts")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null),
    gate.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const debts = (debtsRes.data ?? []) as Debt[];
  const transactions = (txRes.data ?? []) as Transaction[];

  return (
    <div className="strata-page-enter">
      <OverviewClient
        profile={gate.profile}
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
        currentYear={now.getFullYear()}
        currentMonth={now.getMonth() + 1}
      />
    </div>
  );
}
