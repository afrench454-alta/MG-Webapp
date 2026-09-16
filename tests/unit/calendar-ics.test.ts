import test from "node:test";
import assert from "node:assert/strict";

import { jobToVEvent, jobsToIcs } from "../../src/features/console/data/calendar-ics";
import { TEAM_INBOX } from "../../src/lib/brand";

const job = {
  id: "job-ics-1",
  client: "Leonie Black",
  address: "4 D'Aguilar Hwy, Kingaroy QLD 4610",
  category: "Cleaning Services · General Clean",
  scope: "Fortnightly general clean",
  dateKey: "2026-09-17T09:00",
  status: "scheduled" as const,
  assignees: ["Jodie"],
};

test("jobToVEvent writes Brisbane local times and the team inbox as organizer", () => {
  const event = jobToVEvent(job);
  assert.ok(event);
  assert.match(event, /DTSTART;TZID=Australia\/Brisbane:20260917T090000/);
  assert.match(event, /DTEND;TZID=Australia\/Brisbane:20260917T100000/);
  assert.match(event, /ORGANIZER;CN="Mow & Glow":mailto:team@mowglowpropertyservices.com.au/);
  assert.match(event, /SUMMARY:Leonie Black/);
  assert.equal(TEAM_INBOX, "team@mowglowpropertyservices.com.au");
});

test("jobsToIcs skips cancelled jobs and wraps a calendar", () => {
  const ics = jobsToIcs([
    job,
    { ...job, id: "job-ics-2", status: "cancelled", dateKey: "2026-09-18T09:00" },
    { ...job, id: "job-ics-3", dateKey: "" },
  ]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /END:VCALENDAR/);
  assert.match(ics, /UID:job-ics-1@mowglowpropertyservices.com.au/);
  assert.doesNotMatch(ics, /UID:job-ics-2@/);
  assert.doesNotMatch(ics, /UID:job-ics-3@/);
});
