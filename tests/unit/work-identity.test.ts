import test from "node:test";
import assert from "node:assert/strict";

import {
  compactAddress,
  formatJobDisplayName,
  formatSubmissionScope,
  formatWorkLabel,
} from "../../src/features/console/data/work-identity";

test("formatWorkLabel uses client and address so two same-service properties stay distinct", () => {
  const residence = formatWorkLabel({
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · General Clean",
  });
  const studio = formatWorkLabel({
    client: "Northside Studio",
    address: "4 Railway Terrace, Kingaroy",
    category: "Cleaning Services · General Clean",
  });

  assert.equal(
    residence,
    "Northside Studio · 7 McCauley Drive, Booie · Cleaning Services",
  );
  assert.equal(
    studio,
    "Northside Studio · 4 Railway Terrace, Kingaroy · Cleaning Services",
  );
  assert.notEqual(residence, studio);
});

test("formatWorkLabel does not treat missing address placeholders as a site", () => {
  assert.equal(
    formatWorkLabel({
      client: "Harper & Co",
      address: "No service address",
      property: "Service property",
      category: "Yard Services",
    }),
    "Harper & Co · Yard Services",
  );
});

test("compactAddress strips a trailing Australia suffix", () => {
  assert.equal(
    compactAddress("1 Paperbark Street, Toowoomba, Australia"),
    "1 Paperbark Street, Toowoomba",
  );
});

test("formatJobDisplayName appends the scheduled date after the site", () => {
  assert.equal(
    formatJobDisplayName({
      client: "Northside Studio",
      address: "7 McCauley Drive, Booie",
      date: "11 Aug 2026",
    }),
    "Northside Studio · 7 McCauley Drive, Booie · 11 Aug 2026",
  );
});

test("formatSubmissionScope turns answers into a job-request brief", () => {
  const scope = formatSubmissionScope(
    {
      _site_address: "12 Elm Street, Kingaroy",
      bedrooms: "3",
      priorities: ["Kitchen", "Windows"],
    },
    [
      { id: "bedrooms", label: "Bedrooms" },
      { id: "priorities", label: "Priority areas" },
    ],
  );
  assert.match(scope, /Property address: 12 Elm Street, Kingaroy/);
  assert.match(scope, /Bedrooms: 3/);
  assert.match(scope, /Priority areas: Kitchen, Windows/);
});
