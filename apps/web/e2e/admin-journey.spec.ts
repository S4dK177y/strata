import { expect, test, type Page } from "@playwright/test";
import {
  createEphemeralUser,
  deleteEphemeralUser,
  getAdminSupabaseClient,
  type EphemeralUserContext,
} from "./helpers/supabase-admin";

const VIEWPORTS = [
  { name: "mobile", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test.describe("Admin Console journey (/admin telemetry, invites, feature flags & responsive)", () => {
  const adminClient = getAdminSupabaseClient();
  let adminUser: EphemeralUserContext | null = null;
  const createdInviteCodes: string[] = [];

  test.skip(!adminClient, "Requires SUPABASE_SERVICE_ROLE_KEY for ephemeral admin test user");

  test.beforeAll(async () => {
    if (!adminClient) return;
    adminUser = await createEphemeralUser(adminClient, {
      role: "admin",
      onboardingCompleted: true,
      tourCompleted: true,
      seedStarterData: false,
    });
  });

  test.afterAll(async () => {
    if (!adminClient) return;
    for (const code of createdInviteCodes) {
      await adminClient.from("invite_codes").delete().eq("code", code);
    }
    if (adminUser) {
      await deleteEphemeralUser(adminClient, adminUser.userId);
    }
  });

  test("loads telemetry, manages invites, toggles feature flag preview, and fits Mobile/Tablet/Desktop", async ({
    page,
  }) => {
    if (!adminUser) return;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.locator("#signin-email").fill(adminUser.email);
    await page.locator("#signin-password").fill(adminUser.password);
    await page
      .locator('button[type="submit"]')
      .filter({ hasText: /Sign in|Войти/i })
      .click();

    await page.waitForURL("**/");

    // Admin link visible in desktop floating top bar
    const adminNavLink = page.locator('a[href="/admin"]').first();
    await expect(adminNavLink).toBeVisible();
    await adminNavLink.click();
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole("heading", { name: /Admin Console|Админ-панель/i })).toBeVisible();

    // Create unlimited custom invite code
    const testInviteCode = `E2E-INV-${Date.now().toString(36).toUpperCase()}`;
    createdInviteCodes.push(testInviteCode);

    await page.getByRole("button", { name: /New invite|Новый инвайт/i }).click();
    await page.locator("#invite-custom-code").fill(testInviteCode);
    await page.locator("#invite-unlimited").click();
    await expect(page.locator("#invite-max-uses")).toHaveCount(0);
    await page.locator("#invite-note").fill("Playwright E2E unlimited invite");
    await page.getByRole("button", { name: /Create invite|Создать код/i }).click();

    await expect(page.getByText(testInviteCode)).toBeVisible();
    await expect(page.getByText(/0 \/ ∞/).first()).toBeVisible();

    // Toggle invite active state
    const toggleSwitch = page.getByRole("switch", {
      name: new RegExp(testInviteCode),
    });
    await toggleSwitch.click();
    await expect(toggleSwitch).toHaveAttribute("aria-checked", "false");

    // Toggle wrapped_2026 admin_preview switch on and back off
    const wrappedPreviewSwitch = page.getByRole("switch", {
      name: "wrapped_2026 preview",
    });
    const initialChecked = (await wrappedPreviewSwitch.getAttribute("aria-checked")) === "true";
    await wrappedPreviewSwitch.click();
    await expect(wrappedPreviewSwitch).toHaveAttribute(
      "aria-checked",
      initialChecked ? "false" : "true"
    );
    await wrappedPreviewSwitch.click();
    await expect(wrappedPreviewSwitch).toHaveAttribute(
      "aria-checked",
      initialChecked ? "true" : "false"
    );

    // Responsive check across Mobile, Tablet, Desktop
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);
      await assertNoHorizontalOverflow(page);
    }
  });
});
