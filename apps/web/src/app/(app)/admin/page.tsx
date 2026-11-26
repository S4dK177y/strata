import { notFound, redirect } from "next/navigation";
import {
  AdminTelemetrySchema,
  type AdminTelemetry,
  type FeatureFlag,
  type InviteCode,
} from "@strata/api-contract";
import { AdminClient } from "@/components/admin/admin-client";
import { getServerSessionGate } from "@/lib/auth/session-gate";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const gate = await getServerSessionGate();

  if (gate.status !== "ready") {
    redirect("/login");
  }

  // Hide existence of admin UI route from authenticated non-admins
  if (gate.profile.role !== "admin") {
    notFound();
  }

  const [telemetryRes, invitesRes, flagsRes] = await Promise.all([
    gate.supabase.rpc("get_admin_telemetry"),
    gate.supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false }),
    gate.supabase
      .from("feature_flags")
      .select("*")
      .order("key", { ascending: true }),
  ]);

  const parsedTelemetry = AdminTelemetrySchema.safeParse(telemetryRes.data);
  const initialTelemetry: AdminTelemetry | null = parsedTelemetry.success
    ? parsedTelemetry.data
    : null;
  const initialNowMs = initialTelemetry ? Date.parse(initialTelemetry.generated_at) : 0;
  const initialInvites = (invitesRes.data ?? []) as InviteCode[];
  const initialFlags: FeatureFlag[] = (flagsRes.data ?? []).map((row) => ({
    key: row.key,
    enabled: row.enabled,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    admin_preview: row.admin_preview,
    config:
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : {},
    updated_at: row.updated_at,
  }));

  return (
    <div className="strata-page-enter">
      <AdminClient
        initialTelemetry={initialTelemetry}
        initialInvites={initialInvites}
        initialFlags={initialFlags}
        initialNowMs={initialNowMs}
      />
    </div>
  );
}
