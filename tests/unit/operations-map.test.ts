import test from "node:test";
import assert from "node:assert/strict";

import {
  mapInvoiceDocumentStatus,
  mapInvoicePaymentStatus,
  mapJobStatus,
  mapQuoteStatus,
} from "../../src/features/console/data/operations-map";

test("mapQuoteStatus keeps expired and void instead of collapsing to Draft", () => {
  assert.equal(mapQuoteStatus("draft"), "Draft");
  assert.equal(mapQuoteStatus("sent"), "Sent");
  assert.equal(mapQuoteStatus("approved"), "Accepted");
  assert.equal(mapQuoteStatus("declined"), "Declined");
  assert.equal(mapQuoteStatus("expired"), "Expired");
  assert.equal(mapQuoteStatus("void"), "Void");
});

test("mapJobStatus keeps unscheduled and cancelled instead of collapsing to scheduled", () => {
  assert.equal(mapJobStatus("scheduled"), "scheduled");
  assert.equal(mapJobStatus("in_progress"), "in-progress");
  assert.equal(mapJobStatus("paused"), "on-hold");
  assert.equal(mapJobStatus("completed"), "completed");
  assert.equal(mapJobStatus("unscheduled"), "unscheduled");
  assert.equal(mapJobStatus("cancelled"), "cancelled");
});

test("mapInvoicePaymentStatus keeps refunded instead of mapping it to Void", () => {
  assert.equal(mapInvoicePaymentStatus("unpaid"), "Unpaid");
  assert.equal(mapInvoicePaymentStatus("partially_paid"), "Part paid");
  assert.equal(mapInvoicePaymentStatus("paid"), "Paid");
  assert.equal(mapInvoicePaymentStatus("refunded"), "Refunded");
  assert.equal(mapInvoicePaymentStatus("unexpected"), "Unpaid");
});

test("mapInvoiceDocumentStatus keeps issued, sent, and overdue instead of Finalized", () => {
  assert.equal(mapInvoiceDocumentStatus("draft"), "Draft");
  assert.equal(mapInvoiceDocumentStatus("issued"), "Issued");
  assert.equal(mapInvoiceDocumentStatus("sent"), "Sent");
  assert.equal(mapInvoiceDocumentStatus("overdue"), "Overdue");
  assert.equal(mapInvoiceDocumentStatus("void"), "Void");
  assert.equal(mapInvoiceDocumentStatus("finalized"), "Issued");
});
