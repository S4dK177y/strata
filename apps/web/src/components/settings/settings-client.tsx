"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Palette, User } from "lucide-react";
import { toast } from "sonner";
import type { AalLevel, Profile, Theme } from "@strata/api-contract";
import { SUPPORTED_CURRENCIES } from "@/components/onboarding/starter-templates";
import { usePrivacy } from "@/components/providers/privacy-provider";
import { ActiveSessionsCard } from "@/components/settings/active-sessions-card";
import { DangerZoneCard } from "@/components/settings/danger-zone-card";
import { TotpSecurityCard } from "@/components/settings/totp-security-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useI18n } from "@/lib/i18n/client";

export function SettingsClient({
  profile,
  email,
  initialMfaEnabled = false,
  initialAal = "aal1",
}: {
  profile: Profile;
  email: string | null;
  initialMfaEnabled?: boolean;
  initialAal?: AalLevel;
}) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { setPrivacyBlur } = usePrivacy();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [baseCurrency, setBaseCurrency] = useState(profile.base_currency);
  const [themeValue, setThemeValue] = useState<Theme>(profile.theme);
  const [privacyDefault, setPrivacyDefault] = useState(profile.privacy_blur_default);
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          base_currency: baseCurrency,
          locale,
          theme: themeValue,
          privacy_blur_default: privacyDefault,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?reason=session_revoked");
          router.refresh();
          return;
        }
        toast.error(t.errors.generic);
        return;
      }

      toast.success(t.settings.profileSaved);
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--strata-text-primary)]">
          {t.settings.title}
        </h1>
        <p className="text-sm text-[var(--strata-text-muted)]">{t.settings.subtitle}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Card className="space-y-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.settings.profileSection}
            </CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">{t.settings.emailReadOnly}</Label>
              <Input
                id="settings-email"
                type="email"
                value={email ?? ""}
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-name">{t.onboarding.displayNameLabel}</Label>
              <Input
                id="settings-name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.onboarding.displayNamePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.onboarding.currencyLabel}</Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((cur) => (
                    <SelectItem key={cur.code} value={cur.code}>
                      {locale === "en" ? cur.labelEn : cur.labelRu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.locale.label}</Label>
              <Select
                value={locale}
                onValueChange={(val) =>
                  setLocale(val === "en" ? "en" : "ru", { syncServer: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">{t.locale.ru}</SelectItem>
                  <SelectItem value="en">{t.locale.en}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette
                className="h-4 w-4 text-[var(--strata-text-muted)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {t.settings.preferencesSection}
            </CardTitle>
          </CardHeader>

          <div className="space-y-2">
            <Label>{t.theme.label}</Label>
            <ThemeSwitcher
              variant="segmented"
              syncServer
              value={themeValue}
              onChange={setThemeValue}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--strata-bg-elevated)] p-4">
            <div className="space-y-0.5">
              <Label htmlFor="settings-privacy" className="text-sm font-semibold">
                {t.onboarding.privacyDefaultLabel}
              </Label>
              <p className="text-xs text-[var(--strata-text-muted)]">
                {t.onboarding.privacyDefaultHint}
              </p>
            </div>
            <Switch
              id="settings-privacy"
              checked={privacyDefault}
              onCheckedChange={(checked) => {
                setPrivacyDefault(checked);
                setPrivacyBlur(checked);
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? t.common.saving : t.settings.saveProfile}
            </Button>
          </div>
        </Card>
      </form>

      <TotpSecurityCard
        initialMfaEnabled={initialMfaEnabled}
        initialAal={initialAal}
        onMfaChanged={setMfaEnabled}
      />

      <ActiveSessionsCard email={email} />

      <DangerZoneCard mfaEnabled={mfaEnabled} />
    </div>
  );
}
