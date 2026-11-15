import test from "node:test";
import assert from "node:assert/strict";

import type { Invoice, Job } from "../../src/features/console/domain";
import { invoiceDraftSchema, type InvoiceDraftInput } from "../../src/features/console/data/operations-contract";
import {
  assertInvoiceCanBeDeleted,
  assertInvoiceCanBeEdited,
  assertJobCanBeDeleted,
  assertPaymentCanUpdate,
  assertQuoteCanBeEdited,

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

test("invoice draft accepts no service site and preserves canonical dates and different note fields", () => {
  const input: InvoiceDraftInput = {
    clientId: VALID_CLIENT,
    idempotencyKey: VALID_JOB,
    issueDate: "2026-08-05",
    dueDate: "2026-09-04",
    serviceDate: "2026-08-04",
    scope: "Yard cleanup",
    notes: "Visible",
    internalNotes: "Internal",
    terms: "Net 30",
    items: [{ label: "Front garden", unitLabel: "hour", description: "Mowing", quantity: 1.125, rate: 90.25 }],
  };
  assert.deepEqual(invoiceDraftSchema.parse(input), input);
});

test("invoice draft refuses impossible dates, fractional cent rates, and stale draft shapes", () => {
  const base: InvoiceDraftInput = {
    clientId: VALID_CLIENT, propertyId: VALID_PROPERTY, extraPropertyIds: [EXTRA_PROPERTY],
    idempotencyKey: VALID_JOB, issueDate: "2026-08-05", notes: "",
    items: [{ description: "Mowing", quantity: 2, rate: 90 }],
  };
  assert.equal(invoiceDraftSchema.safeParse({ ...base, dueDate: "2026-08-04" }).success, false);
  assert.equal(invoiceDraftSchema.safeParse({ ...base, items: [{ ...base.items[0], rate: 99.999 }] }).success, false);
  assert.equal(invoiceDraftSchema.safeParse({ ...base, id: VALID_JOB }).success, false);
});
