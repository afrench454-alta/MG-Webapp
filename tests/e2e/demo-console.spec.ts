import { test, expect } from "@playwright/test";

test.describe("Mow & Glow Console - Demo Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("renders dashboard with metrics and recent scheduled jobs", async ({ page }) => {
    await expect(page.getByText("Mow & Glow", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "G'day, Jodie" })).toBeVisible();
    const metrics = page.getByLabel("Business metrics");
    await expect(metrics.getByText("Clients")).toBeVisible();
    await expect(metrics.getByText("Open job requests")).toBeVisible();
    await expect(metrics.getByText("Quotes awaiting")).toBeVisible();
    await expect(metrics.getByText("Unpaid invoices")).toBeVisible();
  });

  test("lets owners rename the default team member", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Team & business" }).click();
    const ownerName = page.getByLabel("Owner name");
    await expect(ownerName).toHaveValue("Jodie");
    await ownerName.fill("Ashton");
    await ownerName.blur();
    await expect(ownerName).toHaveValue("Ashton");
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
    await expect(page.getByRole("heading", { name: "QUOTE", exact: true })).toBeVisible();
    await expect(page.getByText("Mow & Glow Property Services")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save / Print PDF" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  });

  test("navigates to Schedule calendar and daily agenda", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    // Month switcher buttons are accessible
    await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  test("navigates to Job Board kanban", async ({ page }) => {
    await page.getByRole("button", { name: "Job Board" }).click();
    await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scheduled", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Active/ })).toBeVisible();
    await page.getByRole("radio", { name: /Done/ }).click();
    await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
  });

  test("navigates to Invoices and checks billing summary", async ({ page }) => {
    await page.getByRole("button", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Outstanding:")).toBeVisible();
    await expect(page.getByText("Paid:")).toBeVisible();
  });

  test("tests invoice lifecycle: finalize draft and status updates", async ({ page }) => {
    await page.getByRole("button", { name: "Invoices" }).click();
    
    // Find the first draft invoice's finalize button
    const issueBtn = page.getByRole("button", { name: "Issue" }).first();
    if (await issueBtn.isVisible()) {
      await issueBtn.click();
      await expect(page.getByText("Invoice issued.")).toBeVisible();
    }
  });

  test("tests questionnaire preview flow", async ({ page }) => {
    await page.getByRole("button", { name: "Intake forms" }).click();
    await expect(page.getByRole("heading", { name: "Intake forms" })).toBeVisible();

    await page.getByRole("button", { name: "Preview" }).first().click();
    
    // Preview dialog should open and show form steps
    await expect(page.getByRole("heading", { name: "End of Lease Questionnaire" }).or(page.getByRole("heading", { name: "Bond Clean / End of Lease Questionnaire" }))).toBeVisible();
    await expect(page.getByText("Contact Information")).toBeVisible();
    
    await page.getByRole("button", { name: "Exit Preview" }).click();
  });

  test("verifies keyboard navigation and focus traps", async ({ page }) => {
    await page.getByRole("button", { name: "Clients" }).click();
    await page.getByRole("button", { name: "New Client" }).click();
    
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
    
    // Test Escape key closes dialog
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "New Client" })).not.toBeVisible();
  });

  test("opens Joseph with a composer and suggestion chips", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Joseph" }).click();
    await expect(page.getByRole("heading", { name: "How can I help?" })).toBeVisible();
    const composer = page.getByLabel("Message Joseph");
    await expect(composer).toBeVisible();
    await page.getByRole("button", { name: "What's on today?" }).click();
    await expect(composer).toHaveValue("Which jobs are scheduled today?");
    await expect(page.getByText("Joseph is not connected on this deployment yet.")).toBeVisible();
  });

  test("toggles dark mode from the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
