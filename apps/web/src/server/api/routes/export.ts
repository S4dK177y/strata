import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  ExportCsvQuerySchema,
  ExportJsonQuerySchema,
  ExportJsonResponseSchema,
  type Account,
  type Category,
  type Debt,
  type Goal,
  type GoalTransfer,
  type RecurringPayment,
  type RecurringPaymentMark,
  type SavingsRule,
  type Transaction,
} from "@strata/api-contract";
import { PROFILE_SELECT_COLUMNS, serializeProfileRow } from "@/lib/auth/profile-serializer";
import { createRequireAuth, requireInviteGate } from "../middleware/auth";
import type { ApiDependencies, ApiEnv } from "../types";

const AUTH_SECURITY: Array<Record<string, string[]>> = [{ bearerAuth: [] }, { cookieAuth: [] }];

function formatMinorExact(minor: number): string {
  const safeMinor = Math.trunc(minor);
  const sign = safeMinor < 0 ? "-" : "";
  const abs = Math.abs(safeMinor);
  const major = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${major}.${frac}`;
}

function escapeCsvCell(value: string): string {
  let safe = value;
  const trimmedStart = safe.replace(/^\s+/, "");
  if (
    safe.length > 0 &&
    (safe[0] === "=" ||
      safe[0] === "+" ||
      safe[0] === "-" ||
      safe[0] === "@" ||
      safe[0] === "\t" ||
      safe[0] === "\r" ||
      trimmedStart.startsWith("=") ||
      trimmedStart.startsWith("+") ||
      trimmedStart.startsWith("-") ||
      trimmedStart.startsWith("@"))
  ) {
    safe = `'${safe}`;
  }
  if (safe.includes('"') || safe.includes(",") || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const exportJsonRoute = createRoute({
  method: "get",
  path: "/export/json",
  tags: ["Export"],
  summary: "Download full personal finance JSON snapshot under RLS",
  security: AUTH_SECURITY,
  request: {
    query: ExportJsonQuerySchema,
  },
  responses: {
    200: {
      description: "Full JSON backup of the authenticated user's data",
      content: {
        "application/json": {
          schema: ExportJsonResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite or MFA required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Export failed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

const exportCsvRoute = createRoute({
  method: "get",
  path: "/export/csv",
  tags: ["Export"],
  summary: "Download filtered transactions ledger as UTF-8 BOM CSV",
  security: AUTH_SECURITY,
  request: {
    query: ExportCsvQuerySchema,
  },
  responses: {
    200: {
      description: "UTF-8 BOM CSV spreadsheet of matching transactions",
      content: {
        "text/csv": {
          schema: { type: "string" },
        },
      },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Invite or MFA required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "Export failed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function createExportRouter(deps: ApiDependencies) {
  const router = new OpenAPIHono<ApiEnv>();
  const requireAuth = createRequireAuth(deps);

  router.use("/export/*", requireAuth, requireInviteGate);

  router.openapi(exportJsonRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const query = c.req.valid("query");
    const includeDeleted = query.include_deleted === "true";

    let accountsQ = auth.supabase
      .from("accounts")
      .select("*")
      .eq("user_id", auth.userId)
      .order("sort_order", { ascending: true });
    let savingsRulesQ = auth.supabase.from("savings_rules").select("*").eq("user_id", auth.userId);
    let categoriesQ = auth.supabase
      .from("categories")
      .select("*")
      .eq("user_id", auth.userId)
      .order("sort_order", { ascending: true });
    let goalsQ = auth.supabase
      .from("goals")
      .select("*")
      .eq("user_id", auth.userId)
      .order("sort_order", { ascending: true });
    let goalTransfersQ = auth.supabase
      .from("goal_transfers")
      .select("*")
      .eq("user_id", auth.userId)
      .order("occurred_at", { ascending: false });
    let recurringQ = auth.supabase
      .from("recurring_payments")
      .select("*")
      .eq("user_id", auth.userId);
    let recurringMarksQ = auth.supabase
      .from("recurring_payment_marks")
      .select("*")
      .eq("user_id", auth.userId);
    let debtsQ = auth.supabase
      .from("debts")
      .select("*")
      .eq("user_id", auth.userId)
      .order("opened_at", { ascending: false });
    let txQ = auth.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", auth.userId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (!includeDeleted) {
      accountsQ = accountsQ.is("deleted_at", null);
      savingsRulesQ = savingsRulesQ.is("deleted_at", null);
      categoriesQ = categoriesQ.is("deleted_at", null);
      goalsQ = goalsQ.is("deleted_at", null);
      goalTransfersQ = goalTransfersQ.is("deleted_at", null);
      recurringQ = recurringQ.is("deleted_at", null);
      recurringMarksQ = recurringMarksQ.is("deleted_at", null);
      debtsQ = debtsQ.is("deleted_at", null);
      txQ = txQ.is("deleted_at", null);
    }

    const [
      profileRes,
      accountsRes,
      savingsRulesRes,
      categoriesRes,
      goalsRes,
      goalTransfersRes,
      recurringRes,
      recurringMarksRes,
      debtsRes,
      txRes,
    ] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", auth.userId)
        .maybeSingle(),
      accountsQ,
      savingsRulesQ,
      categoriesQ,
      goalsQ,
      goalTransfersQ,
      recurringQ,
      recurringMarksQ,
      debtsQ,
      txQ,
    ]);

    const firstError =
      profileRes.error ??
      accountsRes.error ??
      savingsRulesRes.error ??
      categoriesRes.error ??
      goalsRes.error ??
      goalTransfersRes.error ??
      recurringRes.error ??
      recurringMarksRes.error ??
      debtsRes.error ??
      txRes.error;

    if (firstError || !profileRes.data) {
      return c.json(
        {
          error: "EXPORT_FAILED",
          message: firstError?.message ?? "Failed to export user snapshot",
        },
        500
      );
    }

    const serializedProfile = serializeProfileRow(profileRes.data);
    const today = new Date().toISOString().slice(0, 10);

    c.header("Content-Disposition", `attachment; filename="strata-backup-${today}.json"`);
    c.header("Cache-Control", "no-store");

    return c.json(
      {
        schema_version: "1.0" as const,
        exported_at: new Date().toISOString(),
        profile: {
          display_name: serializedProfile.display_name,
          locale: serializedProfile.locale,
          base_currency: serializedProfile.base_currency,
          theme: serializedProfile.theme,
          accent: serializedProfile.accent,
          privacy_blur_default: serializedProfile.privacy_blur_default,
          wrapped_settings: serializedProfile.wrapped_settings,
        },
        accounts: (accountsRes.data ?? []) as Account[],
        savings_rules: (savingsRulesRes.data ?? []) as SavingsRule[],
        categories: (categoriesRes.data ?? []) as Category[],
        goals: (goalsRes.data ?? []) as Goal[],
        goal_transfers: (goalTransfersRes.data ?? []) as GoalTransfer[],
        recurring_payments: (recurringRes.data ?? []) as RecurringPayment[],
        recurring_payment_marks: (recurringMarksRes.data ?? []) as RecurringPaymentMark[],
        debts: (debtsRes.data ?? []) as Debt[],
        transactions: (txRes.data ?? []) as Transaction[],
      },
      200
    );
  });

  router.openapi(exportCsvRoute, async (c) => {
    const auth = c.get("auth");
    if (!auth) {
      return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
    }

    const query = c.req.valid("query");

    let txQuery = auth.supabase
      .from("transactions")
      .select("*")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, 19999);

    if (query.type) txQuery = txQuery.eq("type", query.type);
    if (query.status) txQuery = txQuery.eq("status", query.status);
    if (query.category_id) txQuery = txQuery.eq("category_id", query.category_id);
    if (query.account_id) {
      txQuery = txQuery.or(
        `account_from_id.eq.${query.account_id},account_to_id.eq.${query.account_id}`
      );
    }
    if (query.from) txQuery = txQuery.gte("occurred_at", query.from);
    if (query.to) txQuery = txQuery.lte("occurred_at", query.to);

    const [profileRes, accountsRes, categoriesRes, txRes] = await Promise.all([
      auth.supabase
        .from("profiles")
        .select("base_currency")
        .eq("id", auth.userId)
        .maybeSingle(),
      auth.supabase
        .from("accounts")
        .select("id, name, currency")
        .eq("user_id", auth.userId),
      auth.supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", auth.userId),
      txQuery,
    ]);

    const firstError =
      profileRes.error ?? accountsRes.error ?? categoriesRes.error ?? txRes.error;
    if (firstError) {
      return c.json(
        {
          error: "EXPORT_CSV_FAILED",
          message: firstError.message,
        },
        500
      );
    }

    const baseCurrency = profileRes.data?.base_currency ?? "RUB";
    const accountMap = new Map(
      (accountsRes.data ?? []).map((a) => [a.id, { name: a.name, currency: a.currency }])
    );
    const categoryMap = new Map((categoriesRes.data ?? []).map((cat) => [cat.id, cat.name]));

    const header = [
      "id",
      "occurred_at",
      "type",
      "status",
      "amount_minor",
      "amount_formatted",
      "currency",
      "account_from",
      "account_to",
      "category",
      "comment",
      "source",
    ].join(",");

    const lines = (txRes.data ?? []).map((tx) => {
      const fromAcc = tx.account_from_id ? accountMap.get(tx.account_from_id) : undefined;
      const toAcc = tx.account_to_id ? accountMap.get(tx.account_to_id) : undefined;
      const categoryName = tx.category_id ? (categoryMap.get(tx.category_id) ?? "") : "";
      const currency = fromAcc?.currency ?? toAcc?.currency ?? baseCurrency;

      return [
        escapeCsvCell(tx.id),
        escapeCsvCell(tx.occurred_at),
        escapeCsvCell(tx.type),
        escapeCsvCell(tx.status),
        String(tx.amount_minor),
        formatMinorExact(tx.amount_minor),
        escapeCsvCell(currency),
        escapeCsvCell(fromAcc?.name ?? ""),
        escapeCsvCell(toAcc?.name ?? ""),
        escapeCsvCell(categoryName),
        escapeCsvCell(tx.comment ?? ""),
        escapeCsvCell(tx.source),
      ].join(",");
    });

    const csvBody = `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csvBody, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="strata-operations-${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });

  return router;
}
