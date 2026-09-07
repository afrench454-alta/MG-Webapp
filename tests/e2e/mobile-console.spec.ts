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
    await expect(dock.getByRole("button", { name: "Home" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Schedule" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Quotes" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Invoices" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "More" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Jobs" })).toHaveCount(0);

    await dock.getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    await dock.getByRole("button", { name: "Quotes" }).click();
    await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();
  });
});
