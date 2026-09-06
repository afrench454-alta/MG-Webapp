import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateRequestSchema,
  estimateResultSchema,
  estimateToLineItems,
} from "../../src/features/console/data/estimator-contract";
import {
  businessProfileUpdateSchema,
  teamInviteSchema,
} from "../../src/features/console/data/team-contract";

test("estimateRequestSchema requires a usable scope", () => {
  assert.equal(
    estimateRequestSchema.safeParse({
      category: "Cleaning Services",
      scope: "short",
    }).success,
    false,
  );
  assert.equal(
    estimateRequestSchema.safeParse({
      category: "Yard Services",
      scope: "Overgrown backyard, green waste to be removed, gated access.",
    }).success,
    true,
  );
});

test("estimateResultSchema maps into quote line items", () => {
  const parsed = estimateResultSchema.parse({
    summary: "General clean of a 3-bed home.",
    assumptions: "Standard products, ground-floor access.",
    items: [
      { description: "Labour", quantity: 3, unitLabel: "hrs", rate: 120 },
      { description: "Consumables", quantity: 1, unitLabel: "ea", rate: 25 },
    ],
  });
  const items = estimateToLineItems(parsed);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.unitLabel, "hrs");
  assert.equal(items[1]?.rate, 25);
});

test("team invite and business profile contracts reject empty payloads", () => {
  assert.equal(teamInviteSchema.safeParse({ email: "not-an-email", role: "Technician" }).success, false);
  assert.equal(
    teamInviteSchema.safeParse({
      email: "alex@mowglowpropertyservices.com.au",
      role: "Technician",
    }).success,
    true,
  );
  assert.equal(businessProfileUpdateSchema.safeParse({ name: "" }).success, false);
  assert.equal(
    businessProfileUpdateSchema.safeParse({
      name: "Mow & Glow Property Services",
      email: "team@mowglowpropertyservices.com.au",
    }).success,
    true,
  );
});
