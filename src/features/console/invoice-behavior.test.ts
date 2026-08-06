import assert from "node:assert/strict";
import test from "node:test";

import { invoiceDraftSchema } from "./data/operations-contract";
import { canDeleteInvoiceRecord, canDeleteJobRecord, getInvoiceAddresses } from "./invoice-behavior";

test("invoice draft accepts multiple property ids", () => {
  const draft = invoiceDraftSchema.parse({
    clientId: "11111111-1111-1111-1111-111111111111",
    propertyIds: [
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ],
    dueDays: 7,
    notes: "Due in 7 days",
    items: [{ description: "Service visit", quantity: 1, rate: 120 }],
  });

  assert.deepEqual(draft.propertyIds, [
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
  ]);
});

test("invoice draft rejects an empty property selection", () => {
  assert.throws(() => invoiceDraftSchema.parse({
    clientId: "11111111-1111-1111-1111-111111111111",
    propertyIds: [],
    dueDays: 7,
    notes: "Due in 7 days",
    items: [{ description: "Service visit", quantity: 1, rate: 120 }],
  }));
});

test("invoice document addresses include the primary address first and dedupe duplicates", () => {
  assert.deepEqual(
    getInvoiceAddresses({
      address: "21 Parkside Dr",
      serviceAddresses: ["21 Parkside Dr", "4 D'Aguilar Hwy"],
    }),
    ["21 Parkside Dr", "4 D'Aguilar Hwy"],
  );
});

test("finalized invoices cannot be deleted", () => {
  assert.equal(
    canDeleteInvoiceRecord({ documentStatus: "Finalized" }),
    false,
  );
});

test("jobs with notes, photos, or progressed status cannot be deleted", () => {
  assert.equal(
    canDeleteJobRecord({
      status: "scheduled",
      notes: "Gate code in side pocket",
      photos: [],
    }),
    false,
  );

  assert.equal(
    canDeleteJobRecord({
      status: "scheduled",
      notes: "",
      photos: [{ id: "photo-1" }],
    }),
    false,
  );

  assert.equal(
    canDeleteJobRecord({
      status: "in-progress",
      notes: "",
      photos: [],
    }),
    false,
  );
});
