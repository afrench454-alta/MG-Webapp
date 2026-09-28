import { test, expect } from "@playwright/test";

test.describe("Mow & Glow Console - Mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("uses a phone shell with dock navigation", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "G'day, Jodie" })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "Quick navigation" });
    await expect(dock.getByRole("button", { name: "Today" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Joseph" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Invoices" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "More" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Quotes" })).toHaveCount(0);
    await expect(dock.getByRole("button", { name: "Schedule" })).toHaveCount(0);

    await dock.getByRole("button", { name: "Joseph" }).click();
    await expect(page.getByRole("heading", { name: "Joseph" })).toBeVisible();

    await dock.getByRole("button", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  });

  test("does not horizontally overflow the iPhone 12 Pro viewport", async ({ page }) => {
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      mainMargin: getComputedStyle(document.querySelector(".app-main")!).marginLeft,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.mainMargin).toBe("0px");
  });
});
