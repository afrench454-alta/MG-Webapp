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
    await expect(page.getByRole("heading", { name: /G'day,/ })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "Quick navigation" });
    await dock.getByRole("button", { name: "Jobs" }).click();
    await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completed" })).toHaveCount(0);

    await dock.getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  });
});
