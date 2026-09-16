import test from "node:test";
import assert from "node:assert/strict";

import {
  compactAddress,
  currentMonthStart,
  defaultDateTimeLocal,
  defaultDateTimeLocalForDay,
  formatCalendarEvent,
  formatJobDisplayName,
  formatSiteTitle,
  formatSubmissionScope,
  formatWhen,
  formatWorkLabel,
} from "../../src/features/console/data/work-identity";

test("formatSiteTitle is client and address, not service type", () => {
  assert.equal(
    formatSiteTitle({
      client: "Northside Studio",
      address: "7 McCauley Drive, Booie",
      category: "Cleaning Services · General Clean",
    }),
    "Northside Studio · 7 McCauley Drive, Booie",
  );
});

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

test("formatWorkLabel includes the date so same-site visits stay distinct", () => {
  const monday = formatWorkLabel({
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · General Clean",
    date: "10 Aug 2026",
  });
  const tuesday = formatWorkLabel({
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · General Clean",
    date: "11 Aug 2026",
  });
  assert.equal(
    monday,
    "Northside Studio · 7 McCauley Drive, Booie · 10 Aug 2026 · Cleaning Services",
  );
  assert.equal(
    tuesday,
    "Northside Studio · 7 McCauley Drive, Booie · 11 Aug 2026 · Cleaning Services",
  );
  assert.notEqual(monday, tuesday);
});

test("formatWhen keeps date and time visible without hover", () => {
  assert.equal(
    formatWhen({ client: "Northside Studio", date: "11 Aug 2026", time: "9:00 am" }),
    "11 Aug 2026 · 9:00 am",
  );
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

test("formatCalendarEvent leads with time and street so same-client jobs stay distinct", () => {
  const event = formatCalendarEvent({
    client: "Northside Studio",
    address: "4 Railway Terrace, Kingaroy",
    time: "9:00 am",
  });
  assert.equal(event.primary, "9:00 am · 4 Railway Terrace, Kingaroy");
  assert.equal(event.secondary, "Northside Studio");
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

test("defaultDateTimeLocal is a Brisbane datetime-local value", () => {
  const value = defaultDateTimeLocal(new Date("2026-09-07T02:10:00Z"));
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
});

test("defaultDateTimeLocal rolls to 09:00 the next morning after 5pm Brisbane", () => {
  assert.equal(
    defaultDateTimeLocal(new Date("2026-09-07T08:10:00Z")),
    "2026-09-08T09:00",
  );
});

test("currentMonthStart uses the Brisbane calendar month", () => {
  const month = currentMonthStart(new Date("2026-09-07T20:00:00Z"));
  assert.equal(month.getFullYear(), 2026);
  assert.equal(month.getMonth(), 8);
  assert.equal(month.getDate(), 1);
});

test("defaultDateTimeLocalForDay keeps a picked day at 09:00 unless it is today", () => {
  assert.equal(
    defaultDateTimeLocalForDay("2026-09-20", new Date("2026-09-16T02:00:00Z")),
    "2026-09-20T09:00",
  );
  assert.equal(
    defaultDateTimeLocalForDay(
      "2026-09-16",
      new Date("2026-09-16T02:10:00Z"),
    ),
    defaultDateTimeLocal(new Date("2026-09-16T02:10:00Z")),
  );
});

