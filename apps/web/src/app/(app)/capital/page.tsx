import { redirect } from "next/navigation";
import type { Account, Category, Transaction } from "@strata/api-contract";
import { CapitalClient } from "@/components/capital/capital-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function CapitalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const initialTab =
    resolvedParams.tab === "categories" ? "categories" : "accounts";

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [accountsRes, categoriesRes, txRes] = await Promise.all([
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
      .from("transactions")
      .select("*")
      .eq("user_id", gate.profile.id)
      .eq("status", "confirmed")
      .is("deleted_at", null),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (txRes.data ?? []) as Transaction[];

  return (
    <div className="strata-page-enter">
      <CapitalClient
        baseCurrency={gate.profile.base_currency}
        initialTab={initialTab}
        initialAccounts={accounts}
        initialCategories={categories}
        initialTransactions={transactions}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />
    </div>
  );
}
