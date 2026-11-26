import { redirect } from "next/navigation";
import type { Account, Debt, Transaction } from "@strata/finance-core";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { AppShell } from "@/components/layout/app-shell";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gate = await getServerSessionGate();

  if (gate.status === "unauthenticated") {
    redirect("/login");
  }
  if (gate.status === "needs_invite") {
    redirect("/invite");
  }
  if (gate.status === "needs_onboarding") {
    redirect("/onboarding");
  }

  const [accountsRes, categoriesRes, debtsRes, txRes] = await Promise.all([
    gate.supabase
      .from("accounts")
      .select("id, name, type, initial_balance_minor, credit_limit_minor, is_active")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    gate.supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    gate.supabase
      .from("debts")
      .select("id, direction, counterparty, amount_minor, manual_repaid_minor, opened_at")
      .is("deleted_at", null),
    gate.supabase
      .from("transactions")
      .select(
        "id, occurred_at, type, amount_minor, category_id, account_from_id, account_to_id, goal_id, debt_id, comment, status"
      )
      .is("deleted_at", null),
  ]);

  const accounts: Account[] = (accountsRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as Account["type"],
    initialBalanceMinor: row.initial_balance_minor,
    creditLimitMinor: row.credit_limit_minor,
    isActive: row.is_active,
  }));

  const debts: Debt[] = (debtsRes.data ?? []).map((row) => ({
    id: row.id,
    direction: row.direction as Debt["direction"],
    counterparty: row.counterparty,
    amountMinor: row.amount_minor,
    manualRepaidMinor: row.manual_repaid_minor,
    openedAt: row.opened_at,
  }));

  const transactions: Transaction[] = (txRes.data ?? []).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    type: row.type as Transaction["type"],
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    accountFromId: row.account_from_id,
    accountToId: row.account_to_id,
    goalId: row.goal_id,
    debtId: row.debt_id,
    comment: row.comment,
    status: row.status as Transaction["status"],
  }));

  return (
    <AppShell profile={gate.profile} email={gate.email}>
      <OverviewClient
        profile={gate.profile}
        accounts={accounts}
        transactions={transactions}
        debts={debts}
        categoriesCount={categoriesRes.count ?? 0}
      />
    </AppShell>
  );
}
