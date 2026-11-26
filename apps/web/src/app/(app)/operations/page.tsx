import { redirect } from "next/navigation";
import {
  TransactionStatusSchema,
  TransactionTypeSchema,
  type Account,
  type Category,
  type Transaction,
} from "@strata/api-contract";
import { OperationsClient } from "@/components/operations/operations-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const rawAccount =
    typeof resolvedParams.account === "string" ? resolvedParams.account : "";
  const rawCategory =
    typeof resolvedParams.category === "string" ? resolvedParams.category : "";
  const rawType = typeof resolvedParams.type === "string" ? resolvedParams.type : "";
  const rawStatus = typeof resolvedParams.status === "string" ? resolvedParams.status : "";

  const parsedType = TransactionTypeSchema.safeParse(rawType);
  const parsedStatus = TransactionStatusSchema.safeParse(rawStatus);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthFrom = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
  const monthTo = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  let txQuery = gate.supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", gate.profile.id)
    .is("deleted_at", null)
    .gte("occurred_at", monthFrom)
    .lte("occurred_at", monthTo)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, 49);

  if (rawAccount && /^[0-9a-f-]{36}$/i.test(rawAccount)) {
    txQuery = txQuery.or(`account_from_id.eq.${rawAccount},account_to_id.eq.${rawAccount}`);
  }
  if (rawCategory && /^[0-9a-f-]{36}$/i.test(rawCategory)) {
    txQuery = txQuery.eq("category_id", rawCategory);
  }
  if (parsedType.success) {
    txQuery = txQuery.eq("type", parsedType.data);
  }
  if (parsedStatus.success) {
    txQuery = txQuery.eq("status", parsedStatus.data);
  }

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
    txQuery,
  ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const categories = (categoriesRes.data ?? []) as Category[];
  const initialTransactions = (txRes.data ?? []) as Transaction[];
  const total = txRes.count ?? initialTransactions.length;

  return (
    <div className="strata-page-enter">
      <OperationsClient
        baseCurrency={gate.profile.base_currency}
        accounts={accounts}
        categories={categories}
        initialTransactions={initialTransactions}
        initialTotal={total}
        initialHasMore={initialTransactions.length < total}
        initialPeriodYear={year}
        initialPeriodMonth={month}
        initialAccountFilter={rawAccount}
        initialCategoryFilter={/^[0-9a-f-]{36}$/i.test(rawCategory) ? rawCategory : ""}
        initialTypeFilter={parsedType.success ? parsedType.data : ""}
        initialStatusFilter={parsedStatus.success ? parsedStatus.data : ""}
      />
    </div>
  );
}
