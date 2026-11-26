"use client";

import { useState, type FormEvent } from "react";
import {
  Activity,
  Copy,
  Flag,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTelemetry, FeatureFlag, InviteCode } from "@strata/api-contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModalDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/client";

interface AdminClientProps {
  initialTelemetry: AdminTelemetry | null;
  initialInvites: InviteCode[];
  initialFlags: FeatureFlag[];
  initialNowMs: number;
}

export function AdminClient({
  initialTelemetry,
  initialInvites,
  initialFlags,
  initialNowMs,
}: AdminClientProps) {
  const { locale, t } = useI18n();
  const [telemetry, setTelemetry] = useState<AdminTelemetry | null>(initialTelemetry);
  const [invites, setInvites] = useState<InviteCode[]>(initialInvites);
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [nowMs, setNowMs] = useState(initialNowMs);

  const [refreshingTelemetry, setRefreshingTelemetry] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState("5");
  const [expiresDate, setExpiresDate] = useState("");
  const [note, setNote] = useState("");

  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<InviteCode | null>(null);
  const [busyFlagKey, setBusyFlagKey] = useState<string | null>(null);
  const [confirmDisableInviteOnly, setConfirmDisableInviteOnly] = useState(false);

  async function refreshTelemetry() {
    setRefreshingTelemetry(true);
    try {
      const res = await fetch("/api/v1/admin/telemetry");
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      const json = (await res.json()) as { telemetry: AdminTelemetry };
      setTelemetry(json.telemetry);
      setNowMs(Date.now());
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setRefreshingTelemetry(false);
    }
  }

  async function handleCreateInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedMax = Number.parseInt(maxUses, 10);
    if (!Number.isInteger(parsedMax) || parsedMax < 1 || parsedMax > 10000) {
      toast.error(t.admin.invites.invalidMaxUses);
      return;
    }

    const trimmedCode = customCode.trim();
    if (trimmedCode.length > 0 && !/^[A-Za-z0-9_-]{4,64}$/.test(trimmedCode)) {
      toast.error(t.admin.invites.invalidCodeFormat);
      return;
    }

    setCreatingInvite(true);
    try {
      const payload: Record<string, unknown> = {
        max_uses: parsedMax,
        is_active: true,
      };
      if (trimmedCode.length > 0) payload.code = trimmedCode;
      if (expiresDate.trim().length > 0) {
        payload.expires_at = new Date(`${expiresDate}T23:59:59.000Z`).toISOString();
      }
      if (note.trim().length > 0) payload.note = note.trim();

      const res = await fetch("/api/v1/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        toast.error(t.admin.invites.duplicateError);
        return;
      }
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }

      const json = (await res.json()) as { invite: InviteCode };
      setInvites((prev) => [json.invite, ...prev]);
      setCreateDialogOpen(false);
      setCustomCode("");
      setMaxUses("5");
      setExpiresDate("");
      setNote("");
      toast.success(t.admin.invites.createdToast);
      void refreshTelemetry();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleToggleInvite(invite: InviteCode, nextActive: boolean) {
    setBusyInviteId(invite.id);
    try {
      const res = await fetch(`/api/v1/admin/invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      const json = (await res.json()) as { invite: InviteCode };
      setInvites((prev) => prev.map((row) => (row.id === invite.id ? json.invite : row)));
      toast.success(t.admin.invites.updatedToast);
      void refreshTelemetry();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleDeleteInvite(invite: InviteCode) {
    setBusyInviteId(invite.id);
    try {
      const res = await fetch(`/api/v1/admin/invites/${invite.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      setInvites((prev) => prev.filter((row) => row.id !== invite.id));
      setInviteToDelete(null);
      toast.success(t.admin.invites.deletedToast);
      void refreshTelemetry();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyInviteId(null);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t.admin.invites.copiedToast);
    } catch {
      toast.error(t.errors.generic);
    }
  }

  async function updateFlag(
    key: string,
    patch: { enabled?: boolean; admin_preview?: boolean }
  ) {
    setBusyFlagKey(key);
    try {
      const res = await fetch(`/api/v1/admin/feature-flags/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error(t.errors.generic);
        return;
      }
      const json = (await res.json()) as { flag: FeatureFlag };
      setFlags((prev) => prev.map((f) => (f.key === key ? json.flag : f)));
      toast.success(t.admin.flags.updatedToast);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setBusyFlagKey(null);
    }
  }

  function handleFlagEnabledChange(flag: FeatureFlag, nextEnabled: boolean) {
    if (flag.key === "registration_invite_only" && !nextEnabled) {
      setConfirmDisableInviteOnly(true);
      return;
    }
    void updateFlag(flag.key, { enabled: nextEnabled });
  }

  function getInviteStatus(invite: InviteCode): {
    label: string;
    tone: "brand" | "warn" | "default";
  } {
    if (!invite.is_active) {
      return { label: t.admin.invites.statusPaused, tone: "default" };
    }
    if (nowMs > 0 && invite.expires_at && new Date(invite.expires_at).getTime() <= nowMs) {
      return { label: t.admin.invites.statusExpired, tone: "warn" };
    }
    if (invite.used_count >= invite.max_uses) {
      return { label: t.admin.invites.statusExhausted, tone: "warn" };
    }
    return { label: t.admin.invites.statusActive, tone: "brand" };
  }

  const telemetryMetrics = telemetry
    ? [
        { key: "total_users", label: t.admin.telemetry.totalUsers, value: telemetry.total_users },
        {
          key: "onboarded_users",
          label: t.admin.telemetry.onboardedUsers,
          value: telemetry.onboarded_users,
        },
        {
          key: "invited_users",
          label: t.admin.telemetry.invitedUsers,
          value: telemetry.invited_users,
        },
        {
          key: "active_invites",
          label: t.admin.telemetry.activeInvites,
          value: telemetry.active_invites,
        },
        {
          key: "total_accounts",
          label: t.admin.telemetry.totalAccounts,
          value: telemetry.total_accounts,
        },
        {
          key: "total_transactions",
          label: t.admin.telemetry.totalTransactions,
          value: telemetry.total_transactions,
        },
        {
          key: "transactions_last_30d",
          label: t.admin.telemetry.transactionsLast30d,
          value: telemetry.transactions_last_30d,
        },
        { key: "total_goals", label: t.admin.telemetry.totalGoals, value: telemetry.total_goals },
        { key: "total_debts", label: t.admin.telemetry.totalDebts, value: telemetry.total_debts },
        {
          key: "story_views_total",
          label: t.admin.telemetry.storyViewsTotal,
          value: telemetry.story_views_total,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
          {t.admin.title}
        </h1>
        <p className="text-sm text-[var(--strata-text-muted)]">{t.admin.subtitle}</p>
      </div>

      {/* Privacy by Design Notice */}
      <Card className="flex items-start gap-3.5 border-[var(--strata-border-glow)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--strata-bg-elevated)] text-[var(--strata-accent-brand)]">
          <ShieldCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-bold text-[var(--strata-text-primary)]">
            {t.admin.privacyNoticeTitle}
          </div>
          <p className="text-xs leading-relaxed text-[var(--strata-text-muted)]">
            {t.admin.privacyNoticeBody}
          </p>
        </div>
      </Card>

      {/* Aggregate Telemetry */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.admin.telemetry.title}
            </CardTitle>
            <CardDescription>{t.admin.telemetry.subtitle}</CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={refreshingTelemetry}
            onClick={() => void refreshTelemetry()}
          >
            <RefreshCw
              className={refreshingTelemetry ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {t.admin.telemetry.refresh}
          </Button>
        </div>

        {telemetry ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {telemetryMetrics.map((metric) => (
              <div
                key={metric.key}
                className="min-w-0 rounded-2xl bg-[var(--strata-bg-elevated)] p-3.5"
              >
                <div className="truncate text-xs text-[var(--strata-text-muted)]">
                  {metric.label}
                </div>
                <div className="strata-money mt-1 text-xl font-extrabold text-[var(--strata-text-primary)]">
                  {new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(metric.value)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
            {t.errors.generic}
          </div>
        )}
      </Card>

      {/* Invite Codes */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.admin.invites.title}
            </CardTitle>
            <CardDescription>{t.admin.invites.subtitle}</CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {t.admin.invites.createButton}
          </Button>
        </div>

        {invites.length === 0 ? (
          <div className="rounded-2xl bg-[var(--strata-bg-elevated)] p-4 text-sm text-[var(--strata-text-muted)]">
            {t.admin.invites.empty}
          </div>
        ) : (
          <div className="divide-y divide-[var(--strata-border-subtle)]">
            {invites.map((invite) => {
              const status = getInviteStatus(invite);
              const busy = busyInviteId === invite.id;
              return (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="strata-mono break-all rounded-lg bg-[var(--strata-bg-elevated)] px-2.5 py-1 text-xs font-bold text-[var(--strata-text-primary)]">
                        {invite.code}
                      </code>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="strata-mono text-xs text-[var(--strata-text-muted)]">
                        {invite.used_count}/{invite.max_uses}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--strata-text-muted)]">
                      {invite.note ? <span className="truncate">{invite.note}</span> : null}
                      {invite.expires_at ? (
                        <span>
                          {t.admin.invites.expiresLabel.replace(
                            "{date}",
                            new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US").format(
                              new Date(invite.expires_at)
                            )
                          )}
                        </span>
                      ) : (
                        <span>{t.admin.invites.noExpiry}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.admin.invites.copyAria}
                      onClick={() => void copyInviteCode(invite.code)}
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                    <Switch
                      aria-label={t.admin.invites.toggleAria.replace("{code}", invite.code)}
                      checked={invite.is_active}
                      disabled={busy}
                      onCheckedChange={(checked) => void handleToggleInvite(invite, checked)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={t.admin.invites.deleteAria}
                      onClick={() => setInviteToDelete(invite)}
                      className="text-[var(--strata-money-expense)] hover:bg-[var(--strata-bg-elevated)]"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Feature Flags */}
      <Card className="space-y-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flag
              className="h-4 w-4 text-[var(--strata-text-muted)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {t.admin.flags.title}
          </CardTitle>
          <CardDescription>{t.admin.flags.subtitle}</CardDescription>
        </CardHeader>

        <div className="divide-y divide-[var(--strata-border-subtle)]">
          {flags.map((flag) => {
            const busy = busyFlagKey === flag.key;
            const flagDesc =
              t.admin.flags.descriptions[
                flag.key as keyof typeof t.admin.flags.descriptions
              ] ?? "";

            return (
              <div
                key={flag.key}
                className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="strata-mono break-all text-sm font-bold text-[var(--strata-text-primary)]">
                      {flag.key}
                    </code>
                    <Badge tone={flag.enabled ? "brand" : "default"}>
                      {flag.enabled ? t.admin.flags.on : t.admin.flags.off}
                    </Badge>
                    {flag.admin_preview ? (
                      <Badge tone="warn">{t.admin.flags.previewBadge}</Badge>
                    ) : null}
                  </div>
                  {flagDesc ? (
                    <p className="text-xs text-[var(--strata-text-muted)]">{flagDesc}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--strata-text-muted)]">
                      {t.admin.flags.previewLabel}
                    </span>
                    <Switch
                      aria-label={`${flag.key} preview`}
                      checked={flag.admin_preview}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        void updateFlag(flag.key, { admin_preview: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--strata-text-muted)]">
                      {t.admin.flags.enabledLabel}
                    </span>
                    <Switch
                      aria-label={`${flag.key} enabled`}
                      checked={flag.enabled}
                      disabled={busy}
                      onCheckedChange={(checked) => handleFlagEnabledChange(flag, checked)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Create Invite Dialog */}
      <ModalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title={t.admin.invites.createTitle}
        description={t.admin.invites.createDescription}
      >
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-custom-code">{t.admin.invites.codeLabel}</Label>
            <Input
              id="invite-custom-code"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder={t.admin.invites.codePlaceholder}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-max-uses">{t.admin.invites.maxUsesLabel}</Label>
              <Input
                id="invite-max-uses"
                type="number"
                min={1}
                max={10000}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-expires">{t.admin.invites.expiresInputLabel}</Label>
              <Input
                id="invite-expires"
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-note">{t.admin.invites.noteLabel}</Label>
            <Input
              id="invite-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.admin.invites.notePlaceholder}
              maxLength={240}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={creatingInvite}>
              {creatingInvite ? t.common.saving : t.admin.invites.createSubmit}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Delete Invite Confirm */}
      <ModalDialog
        open={Boolean(inviteToDelete)}
        onOpenChange={(open) => {
          if (!open) setInviteToDelete(null);
        }}
        title={t.admin.invites.deleteTitle}
        description={
          inviteToDelete
            ? t.admin.invites.deleteBody.replace("{code}", inviteToDelete.code)
            : undefined
        }
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => setInviteToDelete(null)}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!inviteToDelete || busyInviteId === inviteToDelete.id}
            onClick={() => {
              if (inviteToDelete) void handleDeleteInvite(inviteToDelete);
            }}
          >
            {t.common.delete}
          </Button>
        </div>
      </ModalDialog>

      {/* Confirm disabling registration_invite_only */}
      <ModalDialog
        open={confirmDisableInviteOnly}
        onOpenChange={setConfirmDisableInviteOnly}
        title={t.admin.flags.confirmDisableInviteTitle}
        description={t.admin.flags.confirmDisableInviteBody}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDisableInviteOnly(false)}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setConfirmDisableInviteOnly(false);
              void updateFlag("registration_invite_only", { enabled: false });
            }}
          >
            {t.admin.flags.confirmDisableInviteButton}
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
