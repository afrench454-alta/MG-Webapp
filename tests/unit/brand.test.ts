import test from "node:test";
import assert from "node:assert/strict";

import {
  brisbaneDateLabel,
  DEFAULT_OWNER_NAME,
  displayNameFromIdentity,
  formatMemberDisplayName,
  gdayGreeting,
  productBrand,
  productName,
  signInIntro,
} from "../../src/lib/brand";

test("product names are Mow & Glow Console, not FieldCentral", () => {
  assert.equal(productBrand, "Mow & Glow");
  assert.equal(productName, "Mow & Glow Console");
  assert.equal(
    signInIntro,
    "Sign in to manage clients, field work, quotes, and invoices.",
  );
  assert.doesNotMatch(productBrand, /FieldCentral/i);
  assert.doesNotMatch(productName, /FieldCentral/i);
});

test("displayNameFromIdentity prefers a real name and otherwise titles the email local part", () => {
  assert.equal(displayNameFromIdentity("Alex Shepherd", "alex@example.com"), "Alex Shepherd");
  assert.equal(displayNameFromIdentity("  ", "ops@mowglowpropertyservices.com.au"), "Ops");
  assert.equal(displayNameFromIdentity(undefined, "jake.smith@example.com"), "Jake Smith");
  assert.equal(displayNameFromIdentity(undefined, undefined), "there");
});

test("gdayGreeting uses Australian hello and the display name", () => {
  assert.equal(gdayGreeting("Alex Shepherd"), "G'day, Alex");
  assert.equal(gdayGreeting("Ops"), "G'day, Ops");
});

test("formatMemberDisplayName uses Jodie for an unnamed owner", () => {
  assert.equal(DEFAULT_OWNER_NAME, "Jodie");
  assert.equal(formatMemberDisplayName(null, null, "owner"), "Jodie");
  assert.equal(formatMemberDisplayName("  ", "", "Owner"), "Jodie");
  assert.equal(formatMemberDisplayName("Ashton", "team@example.com", "owner"), "Ashton");
  assert.equal(formatMemberDisplayName(null, "alex.shepherd@example.com", "Worker"), "Alex Shepherd");
  assert.equal(formatMemberDisplayName(null, null, "Worker"), "Team member");
});

test("brisbaneDateLabel formats a weekday date in Australia/Brisbane", () => {
  const label = brisbaneDateLabel(new Date("2025-05-21T00:00:00+10:00"));
  assert.match(label, /Wed/);
  assert.match(label, /21/);
  assert.match(label, /May/);
});
