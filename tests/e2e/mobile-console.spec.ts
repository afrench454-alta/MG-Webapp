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
    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();

    const dock = page.getByRole("navigation", { name: "Quick navigation" });
    await expect(dock.getByRole("button")).toHaveText(["Today", "Jobs", "More"]);

    await dock.getByRole("button", { name: "Jobs" }).click();
    await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible();
    await expect(page.getByLabel("Job status")).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=jobs/);
    await page.reload();
    await expect(page.getByLabel("Job status")).toBeVisible();

    await dock.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Quotes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Job status")).toBeVisible();
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

  test("shows and bookmarks a populated phone job in every status", async ({ page }) => {
    await page.goto("/?demo=populated&view=jobs");
    const list = page.getByRole("region", { name: "Jobs list" });
    for (const status of ["unscheduled", "scheduled", "in-progress", "on-hold", "completed", "cancelled"]) {
      await page.getByLabel("Job status").selectOption(status);
      await expect(list.getByRole("article")).toHaveCount(1);
      await expect(list.getByText(`Demo ${status.replaceAll("-", " ")} customer`)).toBeVisible();
    }
    await list.getByRole("button", { name: /Demo cancelled customer/ }).click();
    await expect(page).toHaveURL(/[?&]record=demo-job-cancelled/);
    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
