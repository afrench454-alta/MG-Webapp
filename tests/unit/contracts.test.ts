import test from "node:test";
import assert from "node:assert/strict";
import { clientMutationSchema } from "../../src/features/console/data/client-contract";
import { jobRequestDraftSchema } from "../../src/features/console/data/job-request-contract";
import {
  quoteDraftSchema,
  invoiceDraftSchema,
  jobUpdateSchema,
  scheduleJobSchema,
} from "../../src/features/console/data/operations-contract";
import { joinWithPasswordSchema, teamMemberUpdateSchema } from "../../src/features/console/data/team-contract";
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
  assert.equal(isPublicPath("/join/invite-token-value"), true);
  assert.equal(isPublicPath("/sw.js"), true);
  assert.equal(isPublicPath("/manifest.webmanifest"), true);
  assert.equal(isPublicPath("/"), false);
  assert.equal(isPublicPath("/sign-in"), false);
});

test("routing: getSafeReturnPath prevents open redirect attacks", () => {
  assert.equal(getSafeReturnPath("https://evil.com"), "/");
  assert.equal(getSafeReturnPath("//evil.com"), "/");
  assert.equal(getSafeReturnPath("javascript:alert(1)"), "/");
  assert.equal(getSafeReturnPath("/clients?status=Active"), "/clients?status=Active");
  assert.equal(getSafeReturnPath("/sign-in"), "/");
  assert.equal(getSafeReturnPath("/join/invite-token-value"), "/join/invite-token-value");
});

test("contracts: teamMemberUpdateSchema allows renaming the owner without changing role", () => {
  const parsed = teamMemberUpdateSchema.safeParse({
    profileId: VALID_UUID,
    name: "Jodie",
  });
  assert.equal(parsed.success, true);
  assert.equal(
    teamMemberUpdateSchema.safeParse({
      profileId: VALID_UUID,
      name: "   ",
    }).success,
    false,
  );
  assert.equal(
    teamMemberUpdateSchema.safeParse({
      profileId: VALID_UUID,
      role: "Owner",
    }).success,
    false,
  );
});

test("contracts: joinWithPasswordSchema requires a matching password", () => {
  const token = "a".repeat(32);
  assert.equal(
    joinWithPasswordSchema.safeParse({
      token,
      password: "secret123",
      confirm: "secret123",
    }).success,
    true,
  );
  assert.equal(
    joinWithPasswordSchema.safeParse({
      token,
      password: "short",
      confirm: "short",
    }).success,
    false,
  );
  assert.equal(
    joinWithPasswordSchema.safeParse({
      token,
      password: "secret123",
      confirm: "different",
    }).success,
    false,
  );
});

test("contracts: clientMutationSchema validates required fields", () => {
  const validClient = {
    id: "client-123",
    name: "John Doe",
    status: "Active" as const,
    phone: "0400123456",
    email: "john@example.com",
    preferred: "Phone" as const,
    notes: "Client notes",
    properties: [
      { name: "Home", address: "123 Main St, Brisbane", cadence: "Weekly" },
    ],
  };

  const parsed = clientMutationSchema.safeParse(validClient);
  assert.equal(parsed.success, true);

  // Email is optional (empty string is allowed)
  const validClientNoEmail = { ...validClient, email: "" };
  assert.equal(clientMutationSchema.safeParse(validClientNoEmail).success, true);

  // Invalid email format when provided
  const invalidEmail = { ...validClient, email: "invalid-email" };
  assert.equal(clientMutationSchema.safeParse(invalidEmail).success, false);

  // Phone is required (empty string not allowed)
  const invalidNoPhone = { ...validClient, phone: "" };
  assert.equal(clientMutationSchema.safeParse(invalidNoPhone).success, false);

  // Phone too short (< 3 chars)
  const invalidShortPhone = { ...validClient, phone: "12" };
  assert.equal(clientMutationSchema.safeParse(invalidShortPhone).success, false);
});

test("contracts: jobRequestDraftSchema validates service category and scope", () => {
  const validRequest = {
    clientId: VALID_UUID,
    propertyId: ANOTHER_UUID,
    category: "Cleaning Services" as const,
    serviceDetail: "General Clean",
    scope: "3 bed 2 bath house clean",
  };

  const parsed = jobRequestDraftSchema.safeParse(validRequest);
  assert.equal(parsed.success, true);

  const emptyScope = { ...validRequest, scope: "" };
  assert.equal(jobRequestDraftSchema.safeParse(emptyScope).success, false);

  const legacyCategory = {
    ...validRequest,
    category: "Standard / General Clean",
  };
  assert.equal(jobRequestDraftSchema.safeParse(legacyCategory).success, false);

  const fromQuestionnaire = {
    ...validRequest,
    questionnaireResponseId: VALID_UUID,
  };
  assert.equal(jobRequestDraftSchema.safeParse(fromQuestionnaire).success, true);
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

  const withId = quoteDraftSchema.safeParse({
    ...validQuote,
    id: VALID_UUID,
  });
  assert.equal(withId.success, true);

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

  const fromQuote = invoiceDraftSchema.safeParse({
    ...validInvoice,
    quoteId: VALID_UUID,
  });
  assert.equal(fromQuote.success, true);

  const editableDraft = invoiceDraftSchema.safeParse({
    ...validInvoice,
    id: VALID_UUID,
  });
  assert.equal(editableDraft.success, true);
});

test("contracts: scheduleJobSchema validates job schedule inputs", () => {
  const validSchedule = {
    jobRequestId: VALID_UUID,
    scheduledStart: "2026-08-25T09:00:00+10:00",
  };

  const parsed = scheduleJobSchema.safeParse(validSchedule);
  assert.equal(parsed.success, true);

  const withTeam = {
    ...validSchedule,
    profileIds: [VALID_UUID],
  };
  assert.equal(scheduleJobSchema.safeParse(withTeam).success, true);

  const invalidDate = {
    jobRequestId: VALID_UUID,
    scheduledStart: "invalid-date",
  };
  assert.equal(scheduleJobSchema.safeParse(invalidDate).success, false);
});

test("contracts: jobUpdateSchema accepts a new start or a cleared start", () => {
  const base = {
    id: VALID_UUID,
    status: "scheduled",
    notes: "",
    recurrence: "One-off",
  };
  assert.equal(jobUpdateSchema.safeParse(base).success, true);
  assert.equal(
    jobUpdateSchema.safeParse({
      ...base,
      scheduledStart: "2026-09-16T09:00:00+10:00",
    }).success,
    true,
  );
  assert.equal(
    jobUpdateSchema.safeParse({
      ...base,
      status: "unscheduled",
      scheduledStart: null,
    }).success,
    true,
  );
  assert.equal(
    jobUpdateSchema.safeParse({
      ...base,
      scheduledStart: "16 Sep 2026",
    }).success,
    false,
  );
});

import { publicQuestionnaireSchema } from "../../src/features/console/data/questionnaire-contract";

test("contracts: publicQuestionnaireSchema validates forms properly", () => {
  const validPayload = {
    already_submitted: false,
    business: { name: "Mow & Glow" },
    questionnaire: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      version: 1,
      title: "Title",
      introduction: "Intro",
      completion_message: "Done",
      form_schema: {
        fields: [
          { id: "q1", label: "Question 1", type: "radio", required: true, options: ["A", "B"] },
          { id: "q2", label: "Question 2", type: "text", required: false }
        ]
      }
    }
  };

  const parsed = publicQuestionnaireSchema.safeParse(validPayload);
  assert.equal(parsed.success, true);

  const missingTitle = { ...validPayload, questionnaire: { ...validPayload.questionnaire, title: undefined } };
  assert.equal(publicQuestionnaireSchema.safeParse(missingTitle).success, false);
});
