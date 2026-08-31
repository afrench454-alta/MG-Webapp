import test from "node:test";
import assert from "node:assert/strict";
import {
  money,
  quoteTotals,
  businessProfile,
  quoteTerms,
  invoiceTerms,
  type LineItem,
} from "../../src/features/console/domain";

test("quoteTotals: calculates correct subtotal, discount, tax, and total", () => {
  const items: LineItem[] = [
    { description: "Standard Clean", quantity: 2, rate: 80 },
    { description: "Window Cleaning", quantity: 1.5, rate: 50 },
  ];

  // Subtotal = (2 * 80) + (1.5 * 50) = 160 + 75 = 235
  const result = quoteTotals(items, 0, 0);
  assert.equal(result.subtotal, 235);
  assert.equal(result.discount, 0);
  assert.equal(result.taxRate, 0);
  assert.equal(result.tax, 0);
  assert.equal(result.total, 235);
});

test("quoteTotals: handles discount correctly", () => {
  const items: LineItem[] = [
    { description: "Yard Cleanup", quantity: 3, rate: 100 },
  ];

  const result = quoteTotals(items, 50, 0);
  assert.equal(result.subtotal, 300);
  assert.equal(result.discount, 50);
  assert.equal(result.total, 250);
});

test("quoteTotals: handles discount exceeding subtotal gracefully", () => {
  const items: LineItem[] = [
    { description: "Minor Repair", quantity: 1, rate: 40 },
  ];

  const result = quoteTotals(items, 100, 0);
  assert.equal(result.subtotal, 40);
  assert.equal(result.discount, 100);
  assert.equal(result.total, 0);
});

test("quoteTotals: calculates tax rate when non-zero", () => {
  const items: LineItem[] = [
    { description: "Commercial Clean", quantity: 1, rate: 200 },
  ];

  const result = quoteTotals(items, 0, 0.1);
  assert.equal(result.subtotal, 200);
  assert.equal(result.tax, 20);
  assert.equal(result.total, 220);
});

test("quoteTotals: handles empty or invalid line items without NaN", () => {
  const items: LineItem[] = [
    { description: "Empty item", quantity: "", rate: "" },
    { description: "Zero item", quantity: 0, rate: 100 },
  ];

  const result = quoteTotals(items);
  assert.equal(result.subtotal, 0);
  assert.equal(result.total, 0);
  assert.equal(Number.isNaN(result.total), false);
});

test("money: formats currency correctly in AUD", () => {
  const formatted = money(1250.5);
  assert.match(formatted, /\$1,250\.50/);

  const zeroFormatted = money(0);
  assert.match(zeroFormatted, /\$0\.00/);
});

test("businessProfile & terms integrity", () => {
  assert.equal(businessProfile.name, "Mow & Glow Property Services");
  assert.equal(businessProfile.abn, "15 219 585 352");
  assert.ok(quoteTerms.length > 20);
  assert.ok(invoiceTerms.length > 20);
});

import { documentStatusTone, paymentStatusTone } from "../../src/features/console/components/ui-elements";

test("invoice status transitions: valid tone mappings", () => {
  assert.equal(documentStatusTone("Issued"), "success");
  assert.equal(documentStatusTone("Void"), "red");
  assert.equal(documentStatusTone("Draft"), "amber");
  
  assert.equal(paymentStatusTone("Paid"), "success");
  assert.equal(paymentStatusTone("Part paid"), "amber");
  assert.equal(paymentStatusTone("Refunded"), "neutral");
  assert.equal(paymentStatusTone("Unpaid"), "unpaid");
});
