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

test.describe("Core user journey (Dashboard Analytics, Spotlight Tour, Quick Add, Export & Responsive)", () => {
  const admin = getAdminSupabaseClient();
  let user: EphemeralUserContext | null = null;

  test.skip(!admin, "Requires SUPABASE_SERVICE_ROLE_KEY for ephemeral test user lifecycle");

  test.beforeAll(async () => {
    if (!admin) return;
    user = await createEphemeralUser(admin, {
      role: "user",
      onboardingCompleted: true,
      tourCompleted: false,
      seedStarterData: true,
    });
  });

  test.afterAll(async () => {
    if (!admin || !user) return;
    await deleteEphemeralUser(admin, user.userId);
  });

  test("auto-launches Spotlight Tour, records Quick Add math, exports CSV/JSON, enforces non-admin 404/403, and fits all viewports", async ({
    page,
  }) => {
    if (!user) return;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await page.locator("#signin-email").fill(user.email);
    await page.locator("#signin-password").fill(user.password);
    await page
      .locator('button[type="submit"]')
      .filter({ hasText: /Sign in|Войти/i })
      .click();

    await page.waitForURL("**/");

    // 1. Spotlight tour auto-launches once & locks scroll
    const tourDialog = page.getByRole("dialog");
    await expect(tourDialog).toBeVisible({ timeout: 10_000 });
    await expect(tourDialog).toContainText(/1 .* 6/);

    // Page scroll is locked during tour
    const overflowLocked = await page.evaluate(
      () => document.documentElement.style.overflow === "hidden"
    );
    expect(overflowLocked).toBe(true);

    // Advance to step 2 (Privacy Toggle), click the highlighted Privacy Eye and verify tour stays open
    await tourDialog.getByRole("button", { name: /Next|Далее/i }).click();
    await expect(tourDialog).toContainText(/2 .* 6/);
    await page.locator('[data-tour="privacy-toggle"]:visible').first().click();
    await expect(tourDialog).toBeVisible();
    await page.locator('[data-tour="privacy-toggle"]:visible').first().click();
    await expect(tourDialog).toBeVisible();

    await tourDialog.getByRole("button", { name: /Skip tour|Пропустить тур/i }).click();
    await expect(tourDialog).toBeHidden();

    // Reloading "/" must NOT relaunch the tour
    await page.reload();
    await expect(page.locator('[data-tour="hero-balance"]')).toBeVisible();
    await page.waitForTimeout(700);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 2. Dashboard analytics, period switcher & customizable card order
    await expect(page.locator('[data-tour="analytics-charts"]')).toBeVisible();
    await expect(
      page.locator('[data-overview-section="cashflow_trend"] svg').first()
    ).toBeVisible();
    await page.getByRole("tab", { name: /Year|Год/i }).click();
    await page.getByRole("tab", { name: /Month|Месяц/i }).click();

    await page.getByRole("button", { name: /Order|Порядок/i }).click();
    await page.getByRole("button", { name: /Move Ваши счета up|Поднять «Ваши счета»|Move Your accounts up/i }).click();
    await page.getByRole("button", { name: /Done|Готово/i }).first().click();
    await page.waitForTimeout(400);
    await page.reload();
    const sectionOrder = await page
      .locator("[data-overview-section]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-overview-section")));
    expect(sectionOrder.indexOf("accounts")).toBeLessThan(
      sectionOrder.indexOf("category_breakdown")
    );

    // 3. Quick Add via "N" shortcut with calculator expression "=150+50"
    await page.keyboard.press("n");
    const qaAmount = page.locator("#qa-amount");
    await expect(qaAmount).toBeVisible();
    await qaAmount.fill("=150+50");
    await page.locator("#qa-comment").fill("E2E Coffee");
    await page
      .getByRole("button", { name: /Save operation|Сохранить операцию/i })
      .click();
    await expect(qaAmount).toBeHidden();

    // 4. Operations page + CSV download
    await page.goto("/operations");
    await expect(page.getByText("E2E Coffee")).toBeVisible();

    const csvDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV|Экспорт CSV/i }).click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toMatch(/^strata-operations-.*\.csv$/);
    const csvPath = await csvDownload.path();
    if (csvPath) {
      const fs = await import("node:fs");
      const csvText = fs.readFileSync(csvPath, "utf8");
      expect(csvText).toContain("E2E Coffee");
      expect(csvText).toContain("200.00");
    }

    // 5. Settings JSON backup + Replay Tour
    await page.goto("/settings");
    const jsonDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download JSON|Скачать JSON/i }).click();
    const jsonDownload = await jsonDownloadPromise;
    expect(jsonDownload.suggestedFilename()).toMatch(/^strata-backup-.*\.json$/);
    const jsonPath = await jsonDownload.path();
    if (jsonPath) {
      const fs = await import("node:fs");
      const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
        schema_version: string;
        transactions: Array<{ comment: string }>;
      };
      expect(parsed.schema_version).toBe("1.0");
      expect(parsed.transactions.some((tx) => tx.comment === "E2E Coffee")).toBe(true);
    }

    // Replay Tour from Settings and finish all 6 steps
    await page.getByRole("button", { name: /Replay tour|Повторить тур/i }).click();
    await page.waitForURL("**/");
    const replayedDialog = page.getByRole("dialog");
    await expect(replayedDialog).toBeVisible({ timeout: 10_000 });
    for (let i = 0; i < 5; i += 1) {
      await replayedDialog.getByRole("button", { name: /Next|Далее/i }).click();
    }
    await replayedDialog.getByRole("button", { name: /Done|Готово/i }).click();
    await expect(replayedDialog).toBeHidden();

    // 6. Multi-device responsive checks + frosted blur verification (Mobile 360px, Tablet 768px, Desktop 1280px)
    await page.goto("/");
    await page
      .locator('button[aria-haspopup="menu"]:visible')
      .first()
      .click();
    const profileMenu = page.getByRole("menu");
    await expect(profileMenu).toBeVisible();
    const menuCheck = await profileMenu.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const backdrop =
        style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter") || "";
      return {
        isBodyChild: el.parentElement === document.body,
        backdrop,
      };
    });
    expect(menuCheck.isBodyChild).toBe(true);
    expect(menuCheck.backdrop).toContain("blur(");
    await page.keyboard.press("Escape");
    await expect(profileMenu).toBeHidden();

    // Desktop liquid droplet nav indicator check
    const desktopNav = page.locator('nav[aria-label="Main navigation"]');
    await expect(desktopNav).toHaveAttribute("data-liquid-ready", "true");
    await expect(desktopNav.locator(".strata-liquid-svg")).toBeVisible();
    await desktopNav.locator('[data-nav-key="/operations"]').click();
    await page.waitForURL("**/operations");
    await expect(desktopNav.locator('[data-nav-key="/operations"]')).toHaveAttribute(
      "data-active",
      "true"
    );

    for (const route of ["/", "/operations", "/capital", "/settings"]) {
      await page.goto(route);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page);

        if (route === "/" && vp.name === "mobile") {
          const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
          await expect(mobileNav).toHaveAttribute("data-liquid-ready", "true");
          await expect(mobileNav.locator(".strata-liquid-svg")).toBeVisible();
        }

        if (route === "/settings" && vp.name === "mobile") {
          const totpTitleBox = await page
            .getByText(/Two-factor authentication|Двухфакторная аутентификация/i)
            .first()
            .boundingBox();
          expect(totpTitleBox?.width ?? 0).toBeGreaterThanOrEqual(240);
        }
      }
    }

    // 7. Non-admin gets 404 on /admin UI and 403 on /api/v1/admin/telemetry
    const adminPageRes = await page.goto("/admin");
    expect(adminPageRes?.status()).toBe(404);

    const adminApiStatus = await page.evaluate(async () => {
      const res = await fetch("/api/v1/admin/telemetry");
      return res.status;
    });
    expect(adminApiStatus).toBe(403);
  });
});
