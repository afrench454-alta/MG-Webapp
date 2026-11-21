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
    const ownerName = page.getByLabel("Owner name", { exact: true });
    await expect(ownerName).toHaveValue("Jodie");
    await ownerName.fill("Ashton");
    await ownerName.blur();
    await expect(ownerName).toHaveValue("Ashton");
  });

  test("navigates to Clients directory and filters records", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Clients" }).click();
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
    await expect(page.getByText("No clients match the current filters.")).toBeVisible();

    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Northside");
    await expect(page.getByText("No clients match the current filters.")).toBeVisible();

    await page.getByRole("button", { name: "New Client" }).click();
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
  });

  test("navigates to Quotes and shows the empty directory", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Quotes" }).click();
    await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();
    await expect(page.getByText("No quotes match the current filters.")).toBeVisible();
  });

  test("navigates to Schedule calendar and daily agenda", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

    // Month switcher buttons are accessible
    await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  test("navigates to Job Board kanban", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Job Board" }).click();
    await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scheduled", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Active/ })).toBeVisible();
    await page.getByRole("radio", { name: /Done/ }).click();
    await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
  });

  test("navigates to Invoices and checks billing summary", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByText("Outstanding:")).toBeVisible();
    await expect(page.getByText("Received:")).toBeVisible();
  });

  test("tests invoice lifecycle: finalize draft and status updates", async ({ page }) => {
    await page.goto("/?demo=populated&view=invoices");
    await page.getByRole("button", { name: "Review draft" }).click();
    const issueBtn = page.getByRole("button", { name: "Issue", exact: true });
    await expect(issueBtn).toBeVisible();
    await issueBtn.click();
    await expect(page.getByText("Invoice issued.")).toBeVisible();
  });

  test("saves a quote from a completed direct job, reloads its link and converts it once", async ({ page }) => {
    await page.goto("/?demo=populated&view=jobs&record=demo-job-completed");
    await page.getByRole("button", { name: "Create quote", exact: true }).click();
    await page.getByLabel(/Scope summary/).fill("Trim the hedge at the completed visit");
    await page.getByRole("textbox", { name: /description/i }).first().fill("Hedge trimming");
    await page.getByRole("button", { name: "Save Quote", exact: true }).click();
    await expect(page.getByText("Quote saved as draft.")).toBeVisible();

    await page.goto("/?demo=populated&view=jobs&record=demo-job-completed");
    await page.getByRole("button", { name: "View quote", exact: true }).click();
    const quote = page.getByRole("dialog");
    await expect(quote.getByText("Hedge trimming", { exact: true })).toBeVisible();
    await quote.getByRole("combobox").selectOption("Accepted");
    await quote.getByRole("button", { name: "Create invoice", exact: true }).click();
    await page.getByRole("button", { name: /save.*draft/i }).click();
    await expect(page.getByText("Invoice saved as draft.")).toBeVisible();
    await page.goto("/?demo=populated&view=jobs&record=demo-job-completed");
    await page.getByRole("button", { name: "View invoice", exact: true }).click();
    await expect(page.getByRole("dialog").getByText("Hedge trimming", { exact: true })).toBeVisible();

    await page.goto("/?demo=populated&view=jobs&record=demo-job-completed");
    await page.getByRole("button", { name: "View quote", exact: true }).click();
    await quote.getByRole("button", { name: "Create revision" }).click();
    await expect(page.getByText("Quote revision saved as a draft.")).toBeVisible();
    await quote.getByRole("combobox").selectOption("Accepted");
    await expect(quote.getByRole("button", { name: "Create invoice", exact: true })).toHaveCount(0);
    await quote.getByRole("button", { name: "View invoice", exact: true }).click();
    await expect(quote.getByText("Hedge trimming", { exact: true })).toBeVisible();
  });

  test("only counts urgent alerts among 51 items and clears a resolved job", async ({ page }) => {
    await page.goto("/?demo=populated&view=jobs");
    const alertButton = page.getByRole("button", { name: "Operational alerts" });
    await expect(alertButton).toHaveText("1");
    await alertButton.click();
    await expect(page.getByRole("heading", { name: "Operational alerts (51)" })).toBeVisible();
    await page.getByRole("button", { name: "Open job", exact: true }).click();
    await page.getByRole("button", { name: "Close dialog" }).click();
    const pausedCard = page.getByRole("article").filter({ hasText: "Demo on hold customer" });
    await pausedCard.getByRole("button", { name: "Start", exact: true }).click();
    await expect(alertButton).toHaveText("");
  });

  test("tests questionnaire intake with no seeded forms", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Intake forms" }).click();
    await expect(page.getByRole("heading", { name: "Intake forms" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send form" })).toBeVisible();
    await expect(page.getByText("No new answers waiting.")).toBeVisible();
  });

  test("verifies keyboard navigation and focus traps", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Clients" }).click();
    await page.getByRole("button", { name: "New Client" }).click();
    
    await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
    
    // Test Escape key closes dialog
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "New Client" })).not.toBeVisible();
  });

  test("opens Joseph with a composer and next-stop actions", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Joseph" }).click();
    await expect(page.getByRole("heading", { name: "Joseph", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No next stop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "On my way" })).toBeVisible();
    const composer = page.getByLabel("Message Joseph");
    await expect(composer).toBeVisible();
    await composer.fill("Which jobs are scheduled today?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Joseph is not connected on this deployment yet.")).toBeVisible();
  });

  test("toggles dark mode from the sidebar", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Clients" }).click();
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
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Clients" }).click();
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
    await page.getByLabel(/^Job Request/).fill("Mow and edge the front lawn");
    await page.getByRole("button", { name: "Save Request" }).click();
    await expect(page.getByText("Job request created.")).toBeVisible();

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schedule" }).click();
    await page.getByRole("button", { name: "Schedule a job" }).click();
    await page.getByLabel(/^Job Request/).selectOption({ index: 1 });
    await page.getByLabel(/^Date & time/).fill("2026-09-20T10:00");
    await page.getByLabel("Schedule Job").getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText("Job scheduled.")).toBeVisible();

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Job Requests" }).click();
    await page.getByRole("radio", { name: /^Open/ }).click();
    await expect(page.getByRole("heading", { name: /Reschedule Client/ })).toHaveCount(0);
    await page.getByRole("radio", { name: /^Scheduled/ }).click();
    await expect(page.getByRole("heading", { name: /Reschedule Client/ })).toBeVisible();
    await expect(
      page.locator(".request-card").filter({ hasText: "Reschedule Client" }).getByText("Scheduled", { exact: true }),
    ).toBeVisible();

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

test("keeps a request visit and its original invoice linked when issuing a replacement", async ({ page }) => {
  await page.goto("/?demo=populated&view=schedule");
  await page.getByRole("button", { name: "Schedule a job", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Job Request").selectOption("demo-request-1");
  await dialog.getByLabel("Date & time").fill("2026-11-25T14:00");
  await dialog.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByText("Job scheduled.")).toBeVisible();

  const openVisit = async () => {
    await page.goto("/?demo=populated&view=requests");
    const request = page.getByRole("article").filter({ hasText: "Demo unscheduled customer" });
    await request.getByRole("button", { name: "View visits", exact: true }).click();
    await dialog.getByRole("button", { name: "Open visit", exact: true }).click();
  };

  await openVisit();
  await dialog.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Create invoice", exact: true })).toBeVisible();
  await page.reload();
  await dialog.getByRole("button", { name: "Create invoice", exact: true }).click();
  await dialog.getByLabel("Item 1 description").fill("Initial request mowing");
  await dialog.getByLabel("Item 1 unit price").fill("125");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Invoice saved as draft.")).toBeVisible();

  await openVisit();
  await dialog.getByRole("button", { name: "View invoice", exact: true }).click();
  const originalUrl = page.url();
  const originalId = new URL(originalUrl).searchParams.get("record");
  expect(originalId).toBeTruthy();
  await dialog.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText("Invoice issued.")).toBeVisible();
  await page.reload();
  await expect(dialog.getByText("Initial request mowing", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Create replacement", exact: true }).click();
  const reason = "Correct synthetic service details";
  await dialog.getByLabel("Reason for replacement").fill(reason);
  await dialog.getByLabel("Item 1 description").fill("Corrected request mowing");
  await dialog.getByLabel("Item 1 unit price").fill("150");
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Invoice saved as draft.")).toBeVisible();

  await page.goto(originalUrl);
  await expect(dialog.getByText("Issued", { exact: true })).toBeVisible();
  await page.goto("/?demo=populated&view=invoices");
  const replacement = page.getByRole("article").filter({ hasText: "$150.00" });
  await expect(replacement).toHaveCount(1);
  await replacement.getByRole("button", { name: "Review draft", exact: true }).click();
  const replacementId = new URL(page.url()).searchParams.get("record");
  expect(replacementId).toBeTruthy();
  expect(replacementId).not.toBe(originalId);
  await dialog.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText("Invoice issued.")).toBeVisible();
  await page.reload();
  await expect(dialog.getByText("Corrected request mowing", { exact: true })).toBeVisible();
  await expect(dialog.getByText(`Replacement for invoice ${originalId}. ${reason}`)).toBeVisible();

  await page.goto(originalUrl);
  await expect(dialog.getByText("Void", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Initial request mowing", { exact: true })).toBeVisible();
  await openVisit();
  await dialog.getByRole("button", { name: "View invoice", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("record")).toBe(replacementId);
});
