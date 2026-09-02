import test from "node:test";
import assert from "node:assert/strict";

import {
  canCreateInvoiceFromQuote,
  draftInvoiceFromQuote,
  liveInvoiceForQuote,
} from "../../src/features/console/data/quote-invoice";
import type { Client, Invoice, Job, Quote } from "../../src/features/console/domain";

const CLIENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const PROPERTY_ID = "987fcdeb-51a2-43f7-9876-543210fedcba";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const QUOTE_ID = "33333333-3333-4333-8333-333333333333";

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: QUOTE_ID,
    documentNumber: "Q-00012",
    clientId: CLIENT_ID,
    serviceAddressId: PROPERTY_ID,
    jobRequestId: "44444444-4444-4444-8444-444444444444",
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "05 Aug 2026",
    expires: "19 Aug 2026",
    validDays: 14,
    status: "Accepted",
    scope: "Regular studio clean",
    clientNotes: "Please contact us if you wish to amend any items on this quote.",
    items: [
      { description: "Labour", quantity: 2.5, unitLabel: "hrs", rate: 120 },
      { description: "Carpet clean", quantity: 1, unitLabel: "ea", rate: 10 },
    ],
    ...overrides,
  };
}

function client(): Client {
  return {
    id: CLIENT_ID,
    name: "Northside Studio",
    status: "Active",
    phone: "+61 400 000 000",
    email: "admin@example.com",
    preferred: "Email",
    properties: [
      {
        id: PROPERTY_ID,
        name: "Owner Residence",
        address: "7 McCauley Drive, Booie",
        cadence: "Weekly",
      },
    ],
    notes: "",
  };
}

function job(): Job {
  return {
    id: JOB_ID,
    displayName: "Northside Studio · Owner Residence · 11 Aug 2026",
    clientId: CLIENT_ID,
    serviceAddressId: PROPERTY_ID,
    jobRequestId: "44444444-4444-4444-8444-444444444444",
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services",
    scope: "Regular studio clean",
    date: "11 Aug 2026",
    time: "9:00 am",
    dateKey: "2026-08-11T09:00",
    status: "completed",
    notes: "",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    quoteId: QUOTE_ID,
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "11 Aug 2026",
    due: "18 Aug 2026",
    documentStatus: "Issued",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Labour", quantity: 2.5, rate: 120 }],
    ...overrides,
  };
}

test("only accepted quotes can start an invoice", () => {
  assert.equal(canCreateInvoiceFromQuote(quote()), true);
  assert.equal(canCreateInvoiceFromQuote(quote({ status: "Sent" })), false);
  assert.equal(canCreateInvoiceFromQuote(quote({ status: "Draft" })), false);
  assert.equal(canCreateInvoiceFromQuote(quote({ status: "Void" })), false);
});

test("draftInvoiceFromQuote copies client, property, job, and line items", () => {
  const draft = draftInvoiceFromQuote(quote(), [client()], [job()]);
  assert.equal(draft.clientId, CLIENT_ID);
  assert.equal(draft.propertyId, PROPERTY_ID);
  assert.equal(draft.jobId, JOB_ID);
  assert.equal(draft.quoteId, QUOTE_ID);
  assert.equal(draft.items.length, 2);
  assert.equal(draft.items[0]?.description, "Labour");
  assert.equal(draft.items[0]?.rate, 120);
  assert.match(draft.notes, /Q-00012/);
});

test("draftInvoiceFromQuote copies items so quote edits stay independent", () => {
  const source = quote();
  const draft = draftInvoiceFromQuote(source, [client()], [job()]);
  draft.items[0]!.rate = 999;
  assert.equal(source.items[0]?.rate, 120);
});

test("liveInvoiceForQuote ignores voided invoices", () => {
  assert.equal(liveInvoiceForQuote(quote(), [invoice({ documentStatus: "Void" })]), undefined);
  assert.equal(liveInvoiceForQuote(quote(), [invoice()])?.id, "inv-1");
});
