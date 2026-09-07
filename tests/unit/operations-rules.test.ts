import test from "node:test";
import assert from "node:assert/strict";

import type { Invoice, Job } from "../../src/features/console/domain";
import type { InvoiceDraftInput } from "../../src/features/console/data/operations-contract";
import {
  assertInvoiceCanBeDeleted,
  assertInvoiceCanBeEdited,
  assertJobCanBeDeleted,
  assertPaymentCanUpdate,
  assertQuoteCanBeEdited,
  invoiceCreateRpcArgs,
} from "../../src/features/console/data/operations-rules";

const VALID_CLIENT = "123e4567-e89b-12d3-a456-426614174000";
const VALID_PROPERTY = "987fcdeb-51a2-43f7-9876-543210fedcba";
const EXTRA_PROPERTY = "11111111-1111-4111-8111-111111111111";
const VALID_JOB = "22222222-2222-4222-8222-222222222222";

function draftInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "05 Aug 2026",
    due: "12 Aug 2026",
    documentStatus: "Draft",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 80 }],
    ...overrides,
  };
}

function scheduledJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    displayName: "Job",
    client: "Northside Studio",
    property: "Studio",
    address: "4 Railway Terrace",
    category: "Yard Services",
    scope: "Mow and edge",
    date: "05 Aug 2026",
    time: "9:00 am",
    dateKey: "2026-08-05T09:00",
    status: "scheduled",
    notes: "",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
    ...overrides,
  };
}

test("assertInvoiceCanBeDeleted allows drafts only", () => {
  assert.doesNotThrow(() => assertInvoiceCanBeDeleted(draftInvoice()));
  assert.throws(
    () => assertInvoiceCanBeDeleted(draftInvoice({ documentStatus: "Issued" })),
    /void them instead/i,
  );
  assert.throws(
    () => assertInvoiceCanBeDeleted(draftInvoice({ documentStatus: "Void" })),
    /void them instead/i,
  );
});

test("assertInvoiceCanBeEdited and assertQuoteCanBeEdited allow drafts only", () => {
  assert.doesNotThrow(() => assertInvoiceCanBeEdited(draftInvoice()));
  assert.throws(
    () => assertInvoiceCanBeEdited(draftInvoice({ documentStatus: "Issued" })),
    /only draft invoices can be edited/i,
  );
  assert.doesNotThrow(() => assertQuoteCanBeEdited({ status: "Draft" }));
  assert.throws(
    () => assertQuoteCanBeEdited({ status: "Sent" }),
    /only draft quotes can be edited/i,
  );
});

test("assertJobCanBeDeleted allows only scheduled jobs without notes or photos", () => {
  assert.doesNotThrow(() => assertJobCanBeDeleted(scheduledJob()));
  assert.doesNotThrow(() => assertJobCanBeDeleted(scheduledJob({ status: "unscheduled" })));
  assert.throws(
    () => assertJobCanBeDeleted(scheduledJob({ status: "in-progress" })),
    /cancelled or edited instead of deleted/i,
  );
  assert.throws(
    () => assertJobCanBeDeleted(scheduledJob({ status: "completed" })),
    /cancelled or edited instead of deleted/i,
  );
  assert.throws(
    () => assertJobCanBeDeleted(scheduledJob({ notes: "Started the back fence." })),
    /cancelled or edited instead of deleted/i,
  );
  assert.throws(
    () =>
      assertJobCanBeDeleted(
        scheduledJob({
          photos: [
            {
              id: "photo-1",
              name: "before.jpg",
              url: "https://example.com/before.jpg",
              caption: "",
              created: "05 Aug 2026",
            },
          ],
        }),
      ),
    /cancelled or edited instead of deleted/i,
  );
});

test("assertPaymentCanUpdate refuses to revive voided invoices", () => {
  assert.doesNotThrow(() =>
    assertPaymentCanUpdate({ documentStatus: "Issued", paymentStatus: "Unpaid" }),
  );
  assert.throws(
    () => assertPaymentCanUpdate({ documentStatus: "Void", paymentStatus: "Unpaid" }),
    /voided invoice/i,
  );
});

test("invoiceCreateRpcArgs maps primary property, extras, GST-free line items", () => {
  const input: InvoiceDraftInput = {
    clientId: VALID_CLIENT,
    propertyId: VALID_PROPERTY,
    extraPropertyIds: [EXTRA_PROPERTY, VALID_PROPERTY],
    jobId: VALID_JOB,
    dueDays: 7,
    notes: "Due on completion",
    items: [{ description: "Mowing", quantity: 2, rate: 90 }],
  };

  const args = invoiceCreateRpcArgs(input);
  assert.equal(args.target_client_id, VALID_CLIENT);
  assert.equal(args.primary_address_id, VALID_PROPERTY);
  assert.deepEqual(args.service_address_ids, [EXTRA_PROPERTY]);
  assert.equal(args.target_job_id, VALID_JOB);
  assert.equal(args.due_days, 7);
  assert.equal(args.invoice_notes, "Due on completion");
  assert.deepEqual(args.invoice_items, [
    { description: "Mowing", quantity: 2, rate: 90 },
  ]);
});

test("invoiceCreateRpcArgs omits job id when not set", () => {
  const input: InvoiceDraftInput = {
    clientId: VALID_CLIENT,
    propertyId: VALID_PROPERTY,
    dueDays: 0,
    notes: "",
    items: [{ description: "Call-out", quantity: 1, rate: 50 }],
  };
  const args = invoiceCreateRpcArgs(input);
  assert.equal(args.target_job_id, null);
  assert.deepEqual(args.service_address_ids, []);
});
