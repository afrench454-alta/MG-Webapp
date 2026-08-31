import test from "node:test";
import assert from "node:assert/strict";

import {
  matchesClientFilter,
  matchesInvoiceFilter,
  matchesQuoteFilter,
  matchesRequestFilter,
  isLiveInvoice,
  isLiveQuote,
} from "../../src/features/console/data/list-filters";
import type { Client, Invoice, JobRequest, Quote } from "../../src/features/console/domain";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "05 Aug 2026",
    due: "12 Aug 2026",
    dueDate: "2026-08-12",
    documentStatus: "Issued",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 80 }],
    ...overrides,
  };
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "qt-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "05 Aug 2026",
    expires: "19 Aug 2026",
    validDays: 14,
    status: "Sent",
    scope: "Regular clean",
    clientNotes: "",
    items: [{ description: "Clean", quantity: 1, rate: 120 }],
    ...overrides,
  };
}

function request(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "req-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    category: "Standard / General Clean",
    scope: "Weekly clean",
    status: "New",
    created: "05 Aug 2026",
    ...overrides,
  };
}

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Northside Studio",
    status: "Active",
    phone: "+61 400 000 000",
    email: "admin@example.com",
    preferred: "Email",
    properties: [],
    notes: "",
    ...overrides,
  };
}

test("voided invoices are hidden from live, open, and paid views", () => {
  const voided = invoice({ documentStatus: "Void" });
  assert.equal(isLiveInvoice(voided), false);
  assert.equal(matchesInvoiceFilter(voided, "live"), false);
  assert.equal(matchesInvoiceFilter(voided, "open"), false);
  assert.equal(matchesInvoiceFilter(voided, "paid"), false);
  assert.equal(matchesInvoiceFilter(voided, "voided"), true);
});

test("invoice groups keep unpaid work together and paid work together", () => {
  const draft = invoice({ documentStatus: "Draft" });
  const overdue = invoice({ dueDate: "2020-01-01" });
  const paid = invoice({ paymentStatus: "Paid" });
  const refunded = invoice({ paymentStatus: "Refunded" });

  assert.equal(matchesInvoiceFilter(draft, "open"), true);
  assert.equal(matchesInvoiceFilter(overdue, "open"), true);
  assert.equal(matchesInvoiceFilter(paid, "open"), false);
  assert.equal(matchesInvoiceFilter(paid, "paid"), true);
  assert.equal(matchesInvoiceFilter(refunded, "paid"), true);
  assert.equal(matchesInvoiceFilter(draft, "live"), true);
  assert.equal(matchesInvoiceFilter(paid, "voided"), false);
});

test("voided quotes are hidden unless the voided view is selected", () => {
  const voided = quote({ status: "Void" });
  const declined = quote({ status: "Declined" });
  assert.equal(isLiveQuote(voided), false);
  assert.equal(matchesQuoteFilter(voided, "live"), false);
  assert.equal(matchesQuoteFilter(voided, "open"), false);
  assert.equal(matchesQuoteFilter(voided, "accepted"), false);
  assert.equal(matchesQuoteFilter(voided, "voided"), true);
  assert.equal(matchesQuoteFilter(declined, "live"), true);
  assert.equal(matchesQuoteFilter(declined, "open"), false);
});

test("quote open group is draft and sent only", () => {
  assert.equal(matchesQuoteFilter(quote({ status: "Draft" }), "open"), true);
  assert.equal(matchesQuoteFilter(quote({ status: "Sent" }), "open"), true);
  assert.equal(matchesQuoteFilter(quote({ status: "Accepted" }), "open"), false);
  assert.equal(matchesQuoteFilter(quote({ status: "Accepted" }), "accepted"), true);
});

test("request filters group intake, scheduled, and closed work", () => {
  assert.equal(matchesRequestFilter(request({ status: "Quoting" }), "open"), true);
  assert.equal(matchesRequestFilter(request({ status: "Scheduled" }), "scheduled"), true);
  assert.equal(matchesRequestFilter(request({ status: "Rejected" }), "closed"), true);
  assert.equal(matchesRequestFilter(request({ status: "Rejected" }), "open"), false);
});

test("client filters group active, leads, and inactive", () => {
  assert.equal(matchesClientFilter(client({ status: "Active" }), "active"), true);
  assert.equal(matchesClientFilter(client({ status: "Lead" }), "leads"), true);
  assert.equal(matchesClientFilter(client({ status: "Inactive" }), "inactive"), true);
  assert.equal(matchesClientFilter(client({ status: "Inactive" }), "all"), true);
});
