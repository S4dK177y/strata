import { redirect } from "next/navigation";
import type {
  Account,
  Category,
  Debt,
  Goal,
  GoalTransfer,
  RecurringPayment,
  RecurringPaymentMark,
  SavingsRule,
  Transaction,
} from "@strata/api-contract";
import { PlansClient, type PlansTab } from "@/components/plans/plans-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

function resolveInitialTab(raw: unknown): PlansTab {
  if (raw === "recurring" || raw === "goals" || raw === "debts") {
    return raw;
  }
  return "savings";
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const initialTab = resolveInitialTab(resolvedParams.tab);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const asOfDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const [
    accountsRes,
    categoriesRes,
    rulesRes,
    recurringRes,
    marksRes,
    goalsRes,
    goalTransfersRes,
    debtsRes,
    txRes,
  ] = await Promise.all([
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
      .from("savings_rules")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("recurring_payments")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("day_of_month", { ascending: true })
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("recurring_payment_marks")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null),
    gate.supabase
      .from("goals")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("goal_transfers")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
    gate.supabase
      .from("debts")
      .select("*")
      .eq("user_id", gate.profile.id)
      .is("deleted_at", null)
      .order("opened_at", { ascending: true })
      .order("created_at", { ascending: true }),
    gate.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", gate.profile.id)
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false }),
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const savingsRules = ((rulesRes.data ?? []) as SavingsRule[]).map((r) => ({
    ...r,
    base_rate: Number(r.base_rate),
    promo_rate: Number(r.promo_rate),
  }));
  const recurringPayments = (recurringRes.data ?? []) as RecurringPayment[];
  const marks = (marksRes.data ?? []) as RecurringPaymentMark[];
  const goals = (goalsRes.data ?? []) as Goal[];
  const goalTransfers = (goalTransfersRes.data ?? []) as GoalTransfer[];
  const debts = (debtsRes.data ?? []) as Debt[];
  const transactions = (txRes.data ?? []) as Transaction[];
  const promoWarningDays =
    typeof gate.profile.wrapped_settings?.promoWarningDays === "number"
      ? gate.profile.wrapped_settings.promoWarningDays
      : 14;

  return (
    <div className="strata-page-enter">
      <PlansClient
        baseCurrency={gate.profile.base_currency}
        initialTab={initialTab}
        initialAccounts={accounts}
        initialCategories={categories}
        initialSavingsRules={savingsRules}
        initialRecurringPayments={recurringPayments}
        initialMarks={marks}
        initialGoals={goals}
        initialGoalTransfers={goalTransfers}
        initialDebts={debts}
        initialTransactions={transactions}
        initialPromoWarningDays={promoWarningDays}
        currentYear={currentYear}
        currentMonth={currentMonth}
        asOfDate={asOfDate}
      />
    </div>
  );
}
