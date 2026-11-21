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

test("keeps mobile header controls on one row at the iPhone 12 mini width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?demo=populated");
  const nav = page.getByRole("button", { name: "Open navigation" });
  const alerts = page.getByRole("button", { name: "Operational alerts" });
  await expect(nav).toBeVisible();
  await expect(alerts).toBeVisible();
  const rows = await Promise.all([nav.boundingBox(), alerts.boundingBox()]);
  expect(Math.abs(rows[0]!.y + rows[0]!.height / 2 - rows[1]!.y - rows[1]!.height / 2)).toBeLessThan(4);
  await expect(page.getByRole("button", { name: "Quick Create", exact: true })).toBeVisible();
  const identity = page.locator(".top-command-bar__identity strong");
  expect(await identity.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(page.locator("#console-sidebar")).toHaveCSS("box-shadow", "none");
});

test("records a synthetic payment where the browser only exposes getRandomValues", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(crypto, "randomUUID", { value: undefined }));
  await page.goto("/?demo=populated&view=invoices");
  const row = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Review draft" }) });
  await row.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText("Invoice issued.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Record payment", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (AUD)").fill("10");
  await dialog.getByLabel("Payment method").selectOption("cash");
  await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
});
