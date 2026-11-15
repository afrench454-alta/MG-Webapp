import { expect, test } from "@playwright/test";

test("sign-in and console documents expose the candidate policy in report-only mode", async ({ page }) => {
  const signIn = await page.goto("/sign-in");
  expect(signIn?.status()).toBe(200);
  const headers = signIn?.headers();
  expect(headers?.["content-security-policy-report-only"]).toContain("form-action 'self'");
  expect(headers?.["content-security-policy"]).toBeUndefined();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.addInitScript(() => {
    window.print = () => document.documentElement.setAttribute("data-print-invoked", "true");
  });
  const consoleResponse = await page.goto("/?demo=populated&view=invoices");
  expect(consoleResponse?.headers()["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
  await page.getByRole("button", { name: "View", exact: true }).first().click();
  await page.getByRole("button", { name: "Save / Print PDF" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-invoked", "true");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Job Board" }).click();
  await expect(page.getByRole("heading", { name: "Job Board" })).toBeVisible();
});
