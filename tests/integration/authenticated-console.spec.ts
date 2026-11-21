import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("signed-in invoice draft recovers from interruption and persists an issued document and receipt", async ({ page }, info) => {
  const customer = `Browser fixture ${randomUUID()}`;
  const reports = new Set<string>();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP check: ")) reports.add(message.text().slice("CSP check: ".length));
  });
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      const resource = /^(inline|eval|data|blob)$/.test(event.blockedURI) ? event.blockedURI : "URL";
      console.info(`CSP check: ${event.effectiveDirective} ${resource} ${event.disposition}`);
    });
    window.print = () => {
      document.documentElement.dataset.printInvoked = "true";
    };
  });

  try {
    const signIn = await page.goto("/sign-in?next=%2F%3Fview%3Dinvoices");
    expect(signIn?.headers()["content-security-policy-report-only"]).toContain("form-action 'self'");
    expect(signIn?.headers()["content-security-policy"]).toBeUndefined();
    await page.getByLabel("Email", { exact: true }).fill("tenant-a-owner@example.test");
    await page.getByLabel("Password", { exact: true }).fill("MowGlowLocalTest123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const create = page.getByRole("button", { name: "Create Invoice", exact: true });
    await expect(create).toBeVisible();

    await create.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add new client", exact: true }).click();
    await dialog.getByLabel("Client name").fill(customer);
    await dialog.getByLabel("Scope of work").fill("Synthetic garden maintenance");
    await dialog.getByLabel("Item 1 description").fill("Synthetic hedge trimming");
    await dialog.getByLabel("Item 1 quantity").fill("1.25");
    await dialog.getByLabel("Item 1 unit", { exact: true }).fill("hours");
    await dialog.getByLabel("Item 1 unit price").fill("160");
    await dialog.getByLabel("Issue date").fill("2026-11-18");
    await dialog.getByLabel("Due date").fill("2026-12-20");
    await dialog.getByText("Billing details and notes").click();
    await dialog.getByLabel("Internal notes").fill("Synthetic internal-only text");

    let interrupted = false;
    await page.route("**/*", (route) => {
      const request = route.request();
      if (!interrupted && request.method() === "POST" && new URL(request.url()).origin === "http://127.0.0.1:3210") {
        interrupted = true;
        return route.abort();
      }
      return route.continue();
    });
    await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect.poll(() => interrupted).toBe(true);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel("Client name")).toHaveValue(customer);
    await expect(dialog.getByLabel("Due date")).toHaveValue("2026-12-20");
    await expect(dialog.getByLabel("Item 1 unit", { exact: true })).toHaveValue("hours");

    await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("Invoice saved as draft.")).toBeVisible();
    const list = await page.goto("/?view=invoices");
    expect(list?.headers()["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
    expect(list?.headers()["content-security-policy"]).toBeUndefined();
    const row = page.getByRole("article").filter({ hasText: customer });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Review draft", exact: true }).click();
    await expect(dialog.getByText("Synthetic hedge trimming", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Issue", exact: true }).click();
    await expect(page.getByText("Invoice issued.")).toBeVisible();

    await page.goto("/?view=invoices");
    await row.getByRole("button", { name: "Record payment", exact: true }).click();
    await dialog.getByLabel("Amount (AUD)").fill("75");
    await dialog.getByLabel("Payment method").selectOption("cash");
    await dialog.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByText("Payment recorded.")).toBeVisible();
    await page.goto("/?view=invoices");
    await expect(row).toContainText("Received $75.00 · Balance $125.00");
    await row.getByRole("button", { name: "View", exact: true }).click();
    await expect(dialog.getByText("Synthetic hedge trimming", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Synthetic internal-only text", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Save / Print PDF" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
  } finally {
    await info.attach("report-only CSP events", {
      body: JSON.stringify([...reports].sort(), null, 2),
      contentType: "application/json",
    });
  }
});
