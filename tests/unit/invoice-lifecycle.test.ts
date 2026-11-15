import test from "node:test";
import assert from "node:assert/strict";

import type { Invoice } from "../../src/features/console/domain";
import { applyInvoicePaymentEntry, canFinalizeInvoice, canMarkSent, canVoidInvoice, invoiceAmounts, invoiceDisplayStatus } from "../../src/features/console/data/invoice-lifecycle";
import { invoicePaymentSchema, type InvoicePaymentInput } from "../../src/features/console/data/operations-contract";

const invoiceId = "123e4567-e89b-12d3-a456-426614174000";
const receiptId = "987fcdeb-51a2-43f7-9876-543210fedcba";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: invoiceId,
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "05 Aug 2026",
    due: "12 Aug 2026",
    dueDate: "2026-08-12",
    documentStatus: "Issued",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 200 }],
    ...overrides,
  };
}

function receipt(overrides: Partial<InvoicePaymentInput> = {}): InvoicePaymentInput {
  return { invoiceId, idempotencyKey: receiptId, kind: "receipt", amount: 75, paidOn: "2026-08-05", method: "cash", reference: "R008", ...overrides };
}

test("a $75 receipt on a $200 invoice leaves a $125 balance and replay appends nothing", () => {
  const updated = applyInvoicePaymentEntry(invoice(), receipt());
  assert.equal(updated.paymentStatus, "Part paid");
  assert.equal(invoiceAmounts(updated).amountPaid, 75);
  assert.equal(invoiceAmounts(updated).balanceDue, 125);
  assert.equal(updated.payments?.[0]?.method, "cash");
  assert.equal(updated.payments?.[0]?.reference, "R008");
  assert.equal(applyInvoicePaymentEntry(updated, receipt()).payments?.length, 1);
  assert.throws(() => applyInvoicePaymentEntry(updated, receipt({ amount: 20 })), /already used/i);
});

test("recording the exact remainder pays the invoice and a further receipt is rejected", () => {
  const partiallyPaid = applyInvoicePaymentEntry(invoice(), receipt());
  const key = "22222222-2222-4222-8222-222222222222";
  const paid = applyInvoicePaymentEntry(partiallyPaid, receipt({ idempotencyKey: key, amount: 125 }));
  assert.equal(paid.paymentStatus, "Paid");
  assert.equal(invoiceAmounts(paid).balanceDue, 0);
  assert.throws(() => applyInvoicePaymentEntry(paid, receipt({ idempotencyKey: "33333333-3333-4333-8333-333333333333", amount: 1 })), /outstanding/i);
});

test("linked refunds and reversals preserve the receipt and cap the combined correction", () => {
  const partiallyPaid = applyInvoicePaymentEntry(invoice(), receipt());
  const refund = receipt({ idempotencyKey: "22222222-2222-4222-8222-222222222222", kind: "refund", amount: 30, reason: "Extra cash returned", receiptId });
  const corrected = applyInvoicePaymentEntry(partiallyPaid, refund);
  assert.equal(corrected.payments?.[0]?.amount, 75);
  assert.equal(invoiceAmounts(corrected).amountPaid, 45);
  assert.equal(invoiceAmounts(corrected).balanceDue, 155);
  const reversal = receipt({ idempotencyKey: "33333333-3333-4333-8333-333333333333", kind: "reversal", amount: 46, reason: "Entry correction", receiptId });
  assert.throws(() => applyInvoicePaymentEntry(corrected, reversal), /receipt/i);
  const cleared = applyInvoicePaymentEntry(corrected, { ...reversal, amount: 45 });
  assert.equal(cleared.paymentStatus, "Refunded");
  assert.equal(invoiceAmounts(cleared).balanceDue, 200);
  assert.equal(canVoidInvoice(cleared), false);
});

test("payments require an issued invoice and valid explicit payment facts", () => {
  assert.throws(() => applyInvoicePaymentEntry(invoice({ documentStatus: "Draft" }), receipt()), /issued invoice/i);
  assert.equal(invoicePaymentSchema.safeParse(receipt({ amount: 9.005 })).success, false);
  assert.equal(invoicePaymentSchema.safeParse({ ...receipt(), paidOn: undefined, method: undefined }).success, false);
  assert.equal(invoicePaymentSchema.safeParse(receipt({ kind: "refund", receiptId })).success, false);
});

test("invoice amounts use persisted legacy balances and otherwise round line amounts first", () => {
  assert.equal(invoiceAmounts(invoice({ total: 200, amountPaid: 55, balanceDue: 145, paymentStatus: "Part paid" })).balanceDue, 145);
  const items = [{ description: "Lawn", quantity: 0.125, rate: 4.04 }, { description: "Trim", quantity: 0.125, rate: 4.04 }];
  assert.equal(invoiceAmounts(invoice({ items })).total, 1.02);
});

test("display status follows issue, due date, payment and void", () => {
  assert.equal(invoiceDisplayStatus(invoice({ documentStatus: "Draft" })), "Draft");
  assert.equal(invoiceDisplayStatus(invoice({ documentStatus: "Void" })), "Void");
  assert.equal(invoiceDisplayStatus(invoice({ paymentStatus: "Paid" })), "Paid");
  assert.equal(invoiceDisplayStatus(invoice({ paymentStatus: "Refunded" })), "Refunded");
  assert.equal(invoiceDisplayStatus(invoice(), new Date("2026-08-31")), "Overdue");
  assert.equal(invoiceDisplayStatus(invoice({ dueDate: "2099-01-01" }), new Date("2026-08-31")), "Issued");
  assert.equal(canFinalizeInvoice(invoice({ documentStatus: "Draft" })), true);
  assert.equal(canFinalizeInvoice(invoice({ documentStatus: "Draft", duplicateSource: true })), false);
  assert.equal(canMarkSent(invoice()), true);
  assert.equal(canVoidInvoice(invoice()), true);
});
