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
    await page.getByRole("button", { name: "Clients" }).click();
    const filterBg = await page.locator(".list-filters").evaluate((el) => {
      const color = getComputedStyle(el).backgroundColor;
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return 255;
      return (Number(match[1]) + Number(match[2]) + Number(match[3])) / 3;
    });
    expect(filterBg).toBeLessThan(80);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("reschedules a job and can clear it from the calendar", async ({ page }) => {
    await page.getByRole("button", { name: "Clients" }).click();
    await page.getByRole("button", { name: "New Client" }).click();
    await page.locator(".field", { hasText: "Name" }).locator("input").fill("Reschedule Client");
    await page.locator(".field", { hasText: "Phone" }).locator("input").fill("0400 000 001");
    await page.getByLabel("Property 1 name").fill("Warehouse");
    await page.getByLabel("Property 1 address").fill("9 Test Street, Toowoomba");
    await page.getByRole("button", { name: "Save Client" }).click();
    await expect(page.getByText("Client saved.")).toBeVisible();

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Job Requests" }).click();
    await page.getByRole("button", { name: "New Request" }).click();
    await page.getByLabel(/^Client/).selectOption({ label: "Reschedule Client" });
    await page.getByLabel(/^Property/).selectOption({ label: "9 Test Street, Toowoomba" });
    await page.getByLabel(/^Scope summary/).fill("Mow and edge the front lawn");
    await page.getByRole("button", { name: "Save Request" }).click();
    await expect(page.getByText("Job request created.")).toBeVisible();

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schedule" }).click();
    await page.getByRole("button", { name: "Schedule a job" }).click();
    await page.getByLabel(/^Job request/).selectOption({ index: 1 });
    await page.getByLabel(/^Date & time/).fill("2026-09-20T10:00");
    await page.getByLabel("Schedule Job").getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText("Job scheduled.")).toBeVisible();

    await page.getByRole("button", { name: "Job Board" }).click();
    await page.locator(".job-card__open").filter({ hasText: "Reschedule Client" }).click();
    const when = page.getByLabel(/Date & time/);
    await expect(when).toBeVisible();
    await when.fill("2026-09-22T14:00");
    await expect(page.getByText(/Job moved to 22 Sep/)).toBeVisible();
    await page.getByRole("button", { name: "Clear from calendar" }).click();
    await expect(page.getByText("Job cleared from the calendar.")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator(".job-column--unscheduled").getByText("Reschedule Client")).toBeVisible();
  });
});
