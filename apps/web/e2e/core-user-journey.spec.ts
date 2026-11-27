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
    test.setTimeout(60_000);
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

    // 3. Quick Add via "N" shortcut with calculator toggle & expression "=150+50" + single-line account select
    await page.keyboard.press("n");
    const qaAmount = page.locator("#qa-amount");
    await expect(qaAmount).toBeVisible();
    const desktopSelectHeight = await page
      .locator("dialog[open] button[role='combobox']")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(desktopSelectHeight).toBeLessThanOrEqual(52);
    await page.locator("[data-qa-calc-toggle]").click();
    await expect(page.locator("[data-qa-calc-drawer]")).toHaveAttribute("data-open", "true");
    await qaAmount.fill("abc=150+50xyz");
    await expect(qaAmount).toHaveValue("=150+50");
    await page.locator("#qa-comment").fill("E2E Coffee");
    await page
      .getByRole("button", { name: /Save operation|Сохранить операцию/i })
      .click();
    await expect(qaAmount).toBeHidden();

    // 4. Operations page
    await page.goto("/operations");
    await expect(page.getByText("E2E Coffee")).toBeVisible();
    await expect(page.getByRole("button", { name: /Export CSV|Экспорт CSV/i })).toHaveCount(0);
    await expect(
      page.locator("main").getByRole("button", { name: /Add operation|Новая операция/i })
    ).toHaveCount(0);

    // 5. Settings CSV + JSON backup + Replay Tour
    await page.goto("/settings");
    const csvDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download CSV|Скачать CSV/i }).click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toMatch(/^strata-operations-.*\.csv$/);
    const csvPath = await csvDownload.path();
    if (csvPath) {
      const fs = await import("node:fs");
      const csvText = fs.readFileSync(csvPath, "utf8");
      expect(csvText).toContain("E2E Coffee");
      expect(csvText).toContain("200.00");
    }

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
    await desktopNav.locator('[data-nav-key="/plans"]').click();
    await page.waitForURL("**/plans");
    await expect(desktopNav.locator('[data-nav-key="/plans"]')).toHaveAttribute(
      "data-active",
      "true"
    );

    // 6.5 Plans: create a savings rule & recurring bill, verify Promo Radar and Safe-to-Spend deduction
    await page.getByRole("button", { name: /New rule|Новое правило/i }).first().click();
    await page.locator("#sr-base-rate").fill("10");
    await page.locator("#sr-promo-rate").fill("18");
    const soonDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await page.locator("#sr-promo-end").fill(soonDate);
    await page.getByRole("button", { name: /Create rule|Создать правило/i }).click();
    await expect(page.getByText(/18%|Ends in|Истекает/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /Recurring bills|Регулярные платежи/i }).click();
    await page.getByRole("button", { name: /New bill|Новый платёж/i }).first().click();
    await page.locator("#rp-name").fill("E2E Fiber Internet");
    await page.locator("#rp-amount").fill("1000");
    await page.locator("#rp-keyword").fill("E2EFiber");
    await page.getByRole("button", { name: /Create bill|Создать платёж/i }).click();
    await expect(page.getByText("E2E Fiber Internet")).toBeVisible();

    // Partial payment (500 out of 1000) must NOT close the bill
    await page.keyboard.press("n");
    await page.locator("#qa-amount").fill("500");
    await page.locator("#qa-comment").fill("E2EFiber part 1");
    await page
      .getByRole("button", { name: /Save operation|Сохранить операцию/i })
      .click();
    await expect(page.locator("#qa-amount")).toBeHidden();
    await expect(page.getByText(/Partial|Частично/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Pay remaining|Доплатить/i })
    ).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(/Incl\. bills|Учтены платежи/i)).toBeVisible();
    await expect(page.getByText(/Promo Radar|Промо-радар/i)).toBeVisible();

    await page.goto("/plans?tab=recurring");
    await page.getByRole("button", { name: /Mark paid|Отметить/i }).first().click();
    await expect(page.getByRole("button", { name: /Unmark|Снять отметку/i }).first()).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(/Incl\. bills|Учтены платежи/i)).toHaveCount(0);

    // 6.6 Capital: 1-tap category icon picker
    await page.goto("/capital?tab=categories");
    await page
      .getByRole("button", { name: /Change icon: Продукты E2E|Сменить иконку: Продукты E2E/i })
      .click();
    await page.locator("dialog[open]").getByRole("button", { name: "coffee" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await desktopNav.locator('[data-nav-key="/operations"]').click();
    await page.waitForURL("**/operations");
    await expect(desktopNav.locator('[data-nav-key="/operations"]')).toHaveAttribute(
      "data-active",
      "true"
    );

    for (const route of ["/", "/operations", "/capital", "/plans", "/settings"]) {
      await page.goto(route);
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(100);
        await assertNoHorizontalOverflow(page);

        if (route === "/" && vp.name === "mobile") {
          const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
          await expect(mobileNav).toHaveAttribute("data-liquid-ready", "true");
          await expect(mobileNav.locator(".strata-liquid-svg")).toBeVisible();
          await expect(mobileNav.locator('[data-nav-key="/plans"]')).toBeVisible();
          await expect(page.locator('[data-tour="settings-link"]:visible').first()).toBeVisible();

          // Open Receipt Card Quick Add on Mobile 360px and verify zero overflow + single-line select
          await mobileNav.locator('[data-tour="quick-add"]').click();
          await expect(page.locator("#qa-amount")).toBeVisible();
          const mobileSelectHeight = await page
            .locator("dialog[open] button[role='combobox']")
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          expect(mobileSelectHeight).toBeLessThanOrEqual(52);
          await assertNoHorizontalOverflow(page);
          await page.keyboard.press("Escape");
          await expect(page.locator("#qa-amount")).toBeHidden();
        }

        if (route === "/settings" && vp.name === "mobile") {
          const totpTitle = page
            .getByText(/Two-factor authentication|Двухфакторная аутентификация/i)
            .first();
          await expect(totpTitle).toBeVisible({ timeout: 10_000 });
          await totpTitle.scrollIntoViewIfNeeded();
          const totpWidth = await totpTitle.evaluate(
            (el) => el.getBoundingClientRect().width
          );
          expect(totpWidth).toBeGreaterThanOrEqual(240);
          await assertNoHorizontalOverflow(page);
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
