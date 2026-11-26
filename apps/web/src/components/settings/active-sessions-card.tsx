"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { toast } from "sonner";
import type { ActiveSession, SessionListResponse } from "@strata/api-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";

function renderDeviceIcon(deviceType: ActiveSession["device_type"]) {
  switch (deviceType) {
    case "mobile":
      return Smartphone;
    case "tablet":
      return Tablet;
    case "desktop":
      return Monitor;
    default:
      return Globe;
  }
}

export function ActiveSessionsCard({ email }: { email: string | null }) {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<ActiveSession | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchSessionsData = useCallback(async (): Promise<{
    sessions?: ActiveSession[];
    revoked?: boolean;
    error?: boolean;
  }> => {
    try {
      const res = await fetch("/api/v1/security/sessions", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          return { revoked: true };
        }
        return { error: true };
      }

      const data = (await res.json()) as SessionListResponse;
      return { sessions: data.sessions ?? [] };
    } catch {
      return { error: true };
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const result = await fetchSessionsData();
    if (result.revoked) {
      router.push("/login?reason=session_revoked");
      router.refresh();
      return;
    }
    if (result.error) {
      toast.error(t.errors.generic);
    } else if (result.sessions) {
      setSessions(result.sessions);
    }
    setLoading(false);
  }, [fetchSessionsData, router, t.errors.generic]);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await fetchSessionsData();
      if (!active) return;
      if (result.revoked) {
        router.push("/login?reason=session_revoked");
        router.refresh();
        return;
      }
      if (result.error) {
        toast.error(t.errors.generic);
      } else if (result.sessions) {
        setSessions(result.sessions);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [fetchSessionsData, router, t.errors.generic]);

  async function handleRevokeSession() {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/security/sessions/${revokeTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      const body = (await res.json()) as { signed_out_current?: boolean };
      if (body.signed_out_current) {
        router.push("/login?reason=session_revoked");
        router.refresh();
        return;
      }

      setSessions((prev) => prev.filter((item) => item.id !== revokeTarget.id));
      setRevokeTarget(null);
      toast.success(t.settings.sessions.revokedToast);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeOtherSessions() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/security/sessions/revoke-others", {
        method: "POST",
      });

      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      const body = (await res.json()) as { revoked_count: number };
      setSessions((prev) => prev.filter((item) => item.is_current));
      setRevokeOthersOpen(false);
      toast.success(
        t.settings.sessions.revokedOthersToast.replace("{count}", String(body.revoked_count))
      );
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardHeader className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.settings.sessions.title}
            </CardTitle>
            <CardDescription>
              {t.settings.sessions.subtitle}
              {email ? ` · ${email}` : ""}
            </CardDescription>
          </CardHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || busy}
              onClick={() => {
                void loadSessions();
              }}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.settings.sessions.refresh}
            </Button>

            {otherSessionsCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setRevokeOthersOpen(true)}
              >
                {t.settings.sessions.revokeOtherButton}
              </Button>
            ) : null}

            <form action="/auth/signout" method="post">
              <Button type="submit" size="sm" variant="outline">
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {t.settings.sessions.signOutCurrent}
              </Button>
            </form>
          </div>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--strata-text-muted)]"
              aria-hidden="true"
            />
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-2xl bg-[var(--strata-bg-elevated)] px-4 py-3 text-sm text-[var(--strata-text-muted)]">
            {t.settings.sessions.empty}
          </p>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((session) => {
              const Icon = renderDeviceIcon(session.device_type);
              const lastActiveFormatted = dateFormatter.format(new Date(session.last_active_at));

              return (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--strata-bg-elevated)] p-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--strata-bg-surface)] text-[var(--strata-text-secondary)]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--strata-text-primary)]">
                          {session.device_label}
                        </span>
                        {session.is_current ? (
                          <Badge tone="brand">{t.settings.sessions.currentBadge}</Badge>
                        ) : null}
                        {session.aal === "aal2" ? (
                          <Badge tone="default">{t.settings.sessions.aal2Badge}</Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--strata-text-muted)]">
                        <span className="strata-mono">
                          {session.ip || t.settings.sessions.ipUnknown}
                        </span>
                        <span>
                          {t.settings.sessions.lastActive.replace("{time}", lastActiveFormatted)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!session.is_current ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setRevokeTarget(session)}
                    >
                      {t.settings.sessions.revokeButton}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open && !busy) setRevokeTarget(null);
        }}
        title={t.settings.sessions.revokeConfirmTitle}
        description={t.settings.sessions.revokeConfirmBody.replace(
          "{device}",
          revokeTarget?.device_label ?? ""
        )}
        confirmLabel={t.settings.sessions.revokeButton}
        busy={busy}
        onConfirm={handleRevokeSession}
      />

      <ConfirmDialog
        open={revokeOthersOpen}
        onOpenChange={(open) => {
          if (!busy) setRevokeOthersOpen(open);
        }}
        title={t.settings.sessions.revokeOtherTitle}
        description={t.settings.sessions.revokeOtherBody}
        confirmLabel={t.settings.sessions.revokeOtherButton}
        busy={busy}
        onConfirm={handleRevokeOtherSessions}
      />
    </>
  );
}
