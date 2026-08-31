import test from "node:test";
import assert from "node:assert/strict";

import type { Invoice } from "../../src/features/console/domain";
import {
  allowedPaymentStatuses,
  applyInvoicePayment,
  canDeleteInvoice,
  canFinalizeInvoice,
  canMarkPaid,
  canVoidInvoice,
  invoiceDisplayStatus,
  markInvoicePaid,
  voidInvoice,
} from "../../src/features/console/data/invoice-lifecycle";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "05 Aug 2026",
    due: "12 Aug 2026",
    dueDate: "2026-08-12",
    documentStatus: "Draft",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 80 }],
    ...overrides,
  };
}

test("display status: draft stays draft until issued", () => {
  assert.equal(invoiceDisplayStatus(invoice()), "Draft");
});

test("display status: void wins over payment", () => {
  assert.equal(
    invoiceDisplayStatus(invoice({ documentStatus: "Void", paymentStatus: "Unpaid" })),
    "Void",
  );
});

test("display status: paid and refunded win over issued", () => {
  assert.equal(
    invoiceDisplayStatus(invoice({ documentStatus: "Issued", paymentStatus: "Paid" })),
    "Paid",
  );
  assert.equal(
    invoiceDisplayStatus(invoice({ documentStatus: "Issued", paymentStatus: "Refunded" })),
    "Refunded",
  );
});

test("display status: overdue when issued, unpaid, and due date has passed", () => {
  assert.equal(
    invoiceDisplayStatus(
      invoice({ documentStatus: "Issued", paymentStatus: "Unpaid", dueDate: "2020-01-01" }),
      new Date("2026-08-31"),
    ),
    "Overdue",
  );
  assert.equal(
    invoiceDisplayStatus(
      invoice({ documentStatus: "Issued", paymentStatus: "Unpaid", dueDate: "2099-01-01" }),
      new Date("2026-08-31"),
    ),
    "Issued",
  );
});

test("draft can be marked paid or part paid, which issues it in the same step", () => {
  assert.deepEqual(allowedPaymentStatuses(invoice()), [
    "Unpaid",
    "Part paid",
    "Paid",
  ]);
  const paid = applyInvoicePayment(invoice(), "Paid");
  assert.equal(paid.documentStatus, "Issued");
  assert.equal(paid.paymentStatus, "Paid");
  const part = applyInvoicePayment(invoice(), "Part paid");
  assert.equal(part.documentStatus, "Issued");
  assert.equal(part.paymentStatus, "Part paid");
});

test("canMarkPaid is true for drafts and issued unpaid invoices", () => {
  assert.equal(canMarkPaid(invoice()), true);
  assert.equal(canMarkPaid(invoice({ documentStatus: "Issued" })), true);
  assert.equal(
    canMarkPaid(invoice({ documentStatus: "Issued", paymentStatus: "Paid" })),
    false,
  );
  assert.equal(canMarkPaid(invoice({ documentStatus: "Void" })), false);
});

test("issued invoice can move unpaid -> part paid -> paid -> refunded only", () => {
  const issued = invoice({ documentStatus: "Issued", paymentStatus: "Unpaid" });
  assert.deepEqual(allowedPaymentStatuses(issued), ["Unpaid", "Part paid", "Paid"]);
  const part = applyInvoicePayment(issued, "Part paid");
  assert.equal(part.paymentStatus, "Part paid");
  assert.equal(part.documentStatus, "Issued");
  const paid = applyInvoicePayment(part, "Paid");
  assert.equal(paid.paymentStatus, "Paid");
  assert.deepEqual(allowedPaymentStatuses(paid), ["Paid", "Refunded"]);
  const refunded = applyInvoicePayment(paid, "Refunded");
  assert.equal(refunded.paymentStatus, "Refunded");
  assert.deepEqual(allowedPaymentStatuses(refunded), ["Refunded"]);
});

test("void is a document action, not a payment value", () => {
  const issued = invoice({ documentStatus: "Issued", paymentStatus: "Unpaid" });
  assert.equal(canVoidInvoice(issued), true);
  const voided = voidInvoice(issued);
  assert.equal(voided.documentStatus, "Void");
  assert.equal(voided.paymentStatus, "Unpaid");
  assert.throws(() => applyInvoicePayment(voided, "Paid"), /voided/i);
  assert.equal(canVoidInvoice(applyInvoicePayment(issued, "Paid")), false);
});

test("draft can be deleted; issued must be voided", () => {
  assert.equal(canDeleteInvoice(invoice()), true);
  assert.equal(canDeleteInvoice(invoice({ documentStatus: "Issued" })), false);
  assert.equal(canFinalizeInvoice(invoice()), true);
  assert.equal(canFinalizeInvoice(invoice({ documentStatus: "Issued" })), false);
});

test("markInvoicePaid issues a draft and sets paid", () => {
  const paid = markInvoicePaid(invoice());
  assert.equal(paid.documentStatus, "Issued");
  assert.equal(paid.paymentStatus, "Paid");
});
