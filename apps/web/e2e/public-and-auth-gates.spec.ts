import { expect, test, type Page } from "@playwright/test";

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

test.describe("Public gates, auth UX, responsive layout & OpenAPI", () => {
  test("redirects unauthenticated users from private routes to /login", async ({ page }) => {
    for (const route of ["/", "/operations", "/capital", "/settings", "/admin"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("renders /login cleanly without horizontal overflow across Mobile, Tablet, and Desktop", async ({
    page,
  }) => {
    await page.goto("/login");
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(page.locator("#signin-email")).toBeVisible();
      await expect(page.locator("#signin-password")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  });

  test("persists RU/EN locale and Light/Dark theme across reload", async ({ page }) => {
    await page.goto("/login");
    await page.setViewportSize({ width: 1280, height: 800 });

    const html = page.locator("html");
    const initialLang = await html.getAttribute("lang");
    const targetLang = initialLang === "en" ? "ru" : "en";

    const localeToggle = page.getByRole("button", { name: /Language|Язык/i });
    await localeToggle.click();
    await expect(html).toHaveAttribute("lang", targetLang);

    const themeToggle = page.getByRole("button", { name: /theme|тему/i });
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await themeToggle.click();
    await expect(html).toHaveClass(wasDark ? /\blight\b/ : /\bdark\b/);

    await page.reload();
    await expect(html).toHaveAttribute("lang", targetLang);
    await expect(html).toHaveClass(wasDark ? /\blight\b/ : /\bdark\b/);
  });

  test("validates mismatched passwords on signup tab", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: /Create account|Создать аккаунт/i }).click();
    await page.locator("#signup-email").fill("mismatch@example.com");
    await page.locator("#signup-password").fill("StrataPass123!");
    await page.locator("#signup-confirm-password").fill("DifferentPass123!");
    await page
      .locator('button[type="submit"]')
      .filter({ hasText: /Create account|Создать аккаунт/i })
      .click();

    await expect(
      page.getByRole("alert").filter({ hasText: /match|совпадают/i })
    ).toBeVisible();
  });

  test("serves /api/v1/health, /api/v1/openapi.json (3.1.0), and /api/docs", async ({
    request,
  }) => {
    const healthRes = await request.get("/api/v1/health");
    expect(healthRes.status()).toBe(200);
    const healthJson = (await healthRes.json()) as { status: string; app: string };
    expect(healthJson.status).toBe("ok");
    expect(healthJson.app).toBe("strata");

    const openApiRes = await request.get("/api/v1/openapi.json");
    expect(openApiRes.status()).toBe(200);
    const spec = (await openApiRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/api/v1/export/json",
        "/api/v1/export/csv",
        "/api/v1/admin/telemetry",
        "/api/v1/admin/invites",
        "/api/v1/admin/feature-flags",
      ])
    );

    const docsRes = await request.get("/api/docs");
    expect(docsRes.status()).toBe(200);
  });
});
