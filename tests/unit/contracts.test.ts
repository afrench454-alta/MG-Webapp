import test from "node:test";
import assert from "node:assert/strict";
import { clientMutationSchema } from "../../src/features/console/data/client-contract";
import { jobRequestDraftSchema } from "../../src/features/console/data/job-request-contract";
import {
  quoteDraftSchema,
  invoiceDraftSchema,
  scheduleJobSchema,
} from "../../src/features/console/data/operations-contract";
import { getSafeReturnPath, isAuthOnlyPath, isPublicPath } from "../../src/lib/supabase/routing";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const ANOTHER_UUID = "987fcdeb-51a2-43f7-9876-543210fedcba";

test("routing: isAuthOnlyPath correctly identifies protected auth endpoints", () => {
  assert.equal(isAuthOnlyPath("/sign-in"), true);
  assert.equal(isAuthOnlyPath("/auth/callback"), true);
  assert.equal(isAuthOnlyPath("/"), false);
  assert.equal(isAuthOnlyPath("/clients"), false);
});

test("routing: isPublicPath correctly identifies public endpoints", () => {
  assert.equal(isPublicPath("/questionnaire/sample-token"), true);
  assert.equal(isPublicPath("/"), false);
  assert.equal(isPublicPath("/sign-in"), false);
});

test("routing: getSafeReturnPath prevents open redirect attacks", () => {
  assert.equal(getSafeReturnPath("https://evil.com"), "/");
  assert.equal(getSafeReturnPath("//evil.com"), "/");
  assert.equal(getSafeReturnPath("javascript:alert(1)"), "/");
  assert.equal(getSafeReturnPath("/clients?status=Active"), "/clients?status=Active");
  assert.equal(getSafeReturnPath("/sign-in"), "/");
});

test("contracts: clientMutationSchema validates required fields", () => {
  const validClient = {
    id: "client-123",
    name: "John Doe",
    status: "Active" as const,
    phone: "0400123456",
    email: "john@example.com",
    preferred: "Email" as const,
    notes: "Client notes",
    properties: [
      { name: "Home", address: "123 Main St, Brisbane", cadence: "Weekly" },
    ],
  };

  const parsed = clientMutationSchema.safeParse(validClient);
  assert.equal(parsed.success, true);

  const invalidEmail = { ...validClient, email: "invalid-email" };
  assert.equal(clientMutationSchema.safeParse(invalidEmail).success, false);
});

test("contracts: jobRequestDraftSchema validates service category and scope", () => {
  const validRequest = {
    clientId: VALID_UUID,
    propertyId: ANOTHER_UUID,
    category: "Standard / General Clean" as const,
    scope: "3 bed 2 bath house clean",
  };

  const parsed = jobRequestDraftSchema.safeParse(validRequest);
  assert.equal(parsed.success, true);

  const emptyScope = { ...validRequest, scope: "" };
  assert.equal(jobRequestDraftSchema.safeParse(emptyScope).success, false);
});

test("contracts: quoteDraftSchema validates quote payload", () => {
  const validQuote = {
    jobRequestId: VALID_UUID,
    scope: "Standard clean and windows",
    items: [
      { description: "General Clean", quantity: 2, rate: 80 },
    ],
    clientNotes: "Quote valid 14 days",
    internalNotes: "Access code #1234",
  };

  const parsed = quoteDraftSchema.safeParse(validQuote);
  assert.equal(parsed.success, true);

  const invalidUuid = { ...validQuote, jobRequestId: "not-a-uuid" };
  assert.equal(quoteDraftSchema.safeParse(invalidUuid).success, false);

  const emptyItems = { ...validQuote, items: [] };
  assert.equal(quoteDraftSchema.safeParse(emptyItems).success, false);
});

test("contracts: invoiceDraftSchema validates single and multi-property invoices", () => {
  const validInvoice = {
    clientId: VALID_UUID,
    propertyId: ANOTHER_UUID,
    dueDays: 7,
    notes: "Payment due upon completion",
    items: [
      { description: "Mowing & Edging", quantity: 1, rate: 120 },
    ],
  };

  const parsed = invoiceDraftSchema.safeParse(validInvoice);
  assert.equal(parsed.success, true);
});

test("contracts: scheduleJobSchema validates job schedule inputs", () => {
  const validSchedule = {
    jobRequestId: VALID_UUID,
    scheduledStart: "2026-08-25T09:00:00+10:00",
  };

  const parsed = scheduleJobSchema.safeParse(validSchedule);
  assert.equal(parsed.success, true);

  const invalidDate = {
    jobRequestId: VALID_UUID,
    scheduledStart: "invalid-date",
  };
  assert.equal(scheduleJobSchema.safeParse(invalidDate).success, false);
});
