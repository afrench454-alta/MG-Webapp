import { test, expect } from "@playwright/test";

test.describe("FieldCentral Pro Console - Demo Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders dashboard with metrics and recent scheduled jobs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Clients")).toBeVisible();
    await expect(page.getByText("Open job requests")).toBeVisible();
    await expect(page.getByText("Quotes awaiting")).toBeVisible();
    await expect(page.getByText("Unpaid invoices")).toBeVisible();
  });

  test("navigates to Clients directory and filters records", async ({ page }) => {
    await page.getByRole("button", { name: "Clients" }).click();
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

    // Verify search input works
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Northside");
    await expect(page.getByText("Northside Studio")).toBeVisible();

    // Open New Client modal
    await page.getByRole("button", { name: "New Client" }).click();
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
  });

  test("navigates to Quotes and opens Document Preview", async ({ page }) => {
    await page.getByRole("button", { name: "Quotes" }).click();
    await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();

    // View first quote
    await page.getByRole("button", { name: "View" }).first().click();
    await expect(page.getByRole("heading", { name: "QUOTE" })).toBeVisible();
    await expect(page.getByText("Mow & Glow Property Services")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save / Print PDF" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("navigates to Schedule calendar and daily agenda", async ({ page }) => {
    await page.getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    // Month switcher buttons are accessible
    await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  test("navigates to Job Board kanban", async ({ page }) => {
    await page.getByRole("button", { name: "Job Board" }).click();
    await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
  });

  test("navigates to Invoices and checks billing summary", async ({ page }) => {
    await page.getByRole("button", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Outstanding:")).toBeVisible();
    await expect(page.getByText("Paid:")).toBeVisible();
  });

  test("opens and closes AI Scope & Quote Estimator", async ({ page }) => {
    await page.getByRole("button", { name: "AI Estimator" }).first().click();
    await expect(page.getByRole("heading", { name: "AI Scope & Quote Estimator" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "AI Scope & Quote Estimator" })).not.toBeVisible();
  });
});
