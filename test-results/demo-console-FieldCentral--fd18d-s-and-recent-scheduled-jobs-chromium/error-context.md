# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-console.spec.ts >> FieldCentral Pro Console - Demo Mode >> renders dashboard with metrics and recent scheduled jobs
- Location: tests\e2e\demo-console.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Dashboard' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Dashboard' })

```

```yaml
- main:
  - region "Pro Console":
    - paragraph: FieldCentral
    - heading "Pro Console" [level=1]
    - paragraph: Sign in to manage clients, field work, quotes, and invoices.
    - text: Email
    - textbox "Email"
    - text: Password
    - textbox "Password"
    - paragraph
    - button "Sign in"
- alert
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | test.describe("FieldCentral Pro Console - Demo Mode", () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto("/");
  6   |     await page.waitForLoadState("networkidle");
  7   |   });
  8   | 
  9   |   test("renders dashboard with metrics and recent scheduled jobs", async ({ page }) => {
> 10  |     await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  11  |     await expect(page.getByText("Clients")).toBeVisible();
  12  |     await expect(page.getByText("Open job requests")).toBeVisible();
  13  |     await expect(page.getByText("Quotes awaiting")).toBeVisible();
  14  |     await expect(page.getByText("Unpaid invoices")).toBeVisible();
  15  |   });
  16  | 
  17  |   test("navigates to Clients directory and filters records", async ({ page }) => {
  18  |     await page.getByRole("button", { name: "Clients" }).click();
  19  |     await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();
  20  | 
  21  |     // Verify search input works
  22  |     const searchInput = page.getByPlaceholder("Search...");
  23  |     await searchInput.fill("Northside");
  24  |     await expect(page.getByText("Northside Studio")).toBeVisible();
  25  | 
  26  |     // Open New Client modal
  27  |     await page.getByRole("button", { name: "New Client" }).click();
  28  |     await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
  29  |     await page.getByRole("button", { name: "Close dialog" }).click();
  30  |   });
  31  | 
  32  |   test("navigates to Quotes and opens Document Preview", async ({ page }) => {
  33  |     await page.getByRole("button", { name: "Quotes" }).click();
  34  |     await expect(page.getByRole("heading", { name: "Quotes" })).toBeVisible();
  35  | 
  36  |     // View first quote
  37  |     await page.getByRole("button", { name: "View" }).first().click();
  38  |     await expect(page.getByRole("heading", { name: "QUOTE" })).toBeVisible();
  39  |     await expect(page.getByText("Mow & Glow Property Services")).toBeVisible();
  40  |     await expect(page.getByRole("button", { name: "Save / Print PDF" })).toBeVisible();
  41  |     await page.getByRole("button", { name: "Close" }).click();
  42  |   });
  43  | 
  44  |   test("navigates to Schedule calendar and daily agenda", async ({ page }) => {
  45  |     await page.getByRole("button", { name: "Schedule" }).click();
  46  |     await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  47  | 
  48  |     // Month switcher buttons are accessible
  49  |     await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
  50  |     await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  51  |   });
  52  | 
  53  |   test("navigates to Job Board kanban", async ({ page }) => {
  54  |     await page.getByRole("button", { name: "Job Board" }).click();
  55  |     await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
  56  |     await expect(page.getByRole("heading", { name: "Scheduled" })).toBeVisible();
  57  |     await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();
  58  |     await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
  59  |   });
  60  | 
  61  |   test("navigates to Invoices and checks billing summary", async ({ page }) => {
  62  |     await page.getByRole("button", { name: "Invoices" }).click();
  63  |     await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  64  |     await expect(page.getByText("Outstanding:")).toBeVisible();
  65  |     await expect(page.getByText("Paid:")).toBeVisible();
  66  |   });
  67  | 
  68  |   test("tests invoice lifecycle: finalize draft and status updates", async ({ page }) => {
  69  |     await page.getByRole("button", { name: "Invoices" }).click();
  70  |     
  71  |     // Find the first draft invoice's finalize button
  72  |     const finalizeBtn = page.getByRole("button", { name: "Finalize" }).first();
  73  |     if (await finalizeBtn.isVisible()) {
  74  |       await finalizeBtn.click();
  75  |       
  76  |       // Should show the finalized document view
  77  |       await expect(page.getByRole("heading", { name: "INVOICE" })).toBeVisible();
  78  |       await expect(page.getByText("Status: Finalized")).toBeVisible();
  79  |       await page.getByRole("button", { name: "Close" }).click();
  80  |     }
  81  |   });
  82  | 
  83  |   test("tests questionnaire preview flow", async ({ page }) => {
  84  |     await page.getByRole("button", { name: "Questionnaires" }).click();
  85  |     await expect(page.getByRole("heading", { name: "Assessment Questionnaires" })).toBeVisible();
  86  | 
  87  |     await page.getByRole("button", { name: "Preview Form" }).first().click();
  88  |     
  89  |     // Preview dialog should open and show form steps
  90  |     await expect(page.getByRole("heading", { name: "End of Lease Questionnaire" }).or(page.getByRole("heading", { name: "Bond Clean / End of Lease Questionnaire" }))).toBeVisible();
  91  |     await expect(page.getByText("Contact Information")).toBeVisible();
  92  |     
  93  |     await page.getByRole("button", { name: "Exit Preview" }).click();
  94  |   });
  95  | 
  96  |   test("verifies keyboard navigation and focus traps", async ({ page }) => {
  97  |     await page.getByRole("button", { name: "Clients" }).click();
  98  |     await page.getByRole("button", { name: "New Client" }).click();
  99  |     
  100 |     await expect(page.getByRole("heading", { name: "New Client" })).toBeVisible();
  101 |     
  102 |     // Test Escape key closes dialog
  103 |     await page.keyboard.press("Escape");
  104 |     await expect(page.getByRole("heading", { name: "New Client" })).not.toBeVisible();
  105 |   });
  106 | });
  107 | 
```