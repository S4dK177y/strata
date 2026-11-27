import { redirect } from "next/navigation";
import type {
  Account,
  Category,
  Debt,
  RecurringPayment,
  RecurringPaymentMark,
  SavingsRule,
  Transaction,
} from "@strata/api-contract";
import { OverviewClient } from "@/components/dashboard/overview-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const asOfDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const [accountsRes, categoriesRes, debtsRes, txRes, rulesRes, recurringRes, marksRes] =
    await Promise.all([
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
      gate.supabase
        .from("savings_rules")
        .select("*")
        .eq("user_id", gate.profile.id)
        .is("deleted_at", null),
      gate.supabase
        .from("recurring_payments")
        .select("*")
        .eq("user_id", gate.profile.id)
        .is("deleted_at", null),
      gate.supabase
        .from("recurring_payment_marks")
        .select("*")
        .eq("user_id", gate.profile.id)
        .is("deleted_at", null),
    ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const debts = (debtsRes.data ?? []) as Debt[];
  const transactions = (txRes.data ?? []) as Transaction[];
  const savingsRules = ((rulesRes.data ?? []) as SavingsRule[]).map((r) => ({
    ...r,
    base_rate: Number(r.base_rate),
    promo_rate: Number(r.promo_rate),
  }));
  const recurringPayments = (recurringRes.data ?? []) as RecurringPayment[];
  const recurringMarks = (marksRes.data ?? []) as RecurringPaymentMark[];

  return (
    <div className="strata-page-enter">
      <OverviewClient
        profile={gate.profile}
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
        savingsRules={savingsRules}
        recurringPayments={recurringPayments}
        recurringMarks={recurringMarks}
        currentYear={currentYear}
        currentMonth={currentMonth}
        asOfDate={asOfDate}
      />
    </div>
  );
}
