import test from "node:test";
import assert from "node:assert/strict";

import {
  asJobRecurrence,
  buildNextDemoJob,
  dateKeyToIso,
  nextScheduledIso,
  recurrenceToDb,
} from "../../src/features/console/data/job-recurrence";
import type { Job } from "../../src/features/console/domain";

test("asJobRecurrence: unknown values become one-off", () => {
  assert.equal(asJobRecurrence("Weekly"), "Weekly");
  assert.equal(asJobRecurrence("Whenever"), "One-off");
});

test("recurrenceToDb: maps console labels onto frequency rows", () => {
  assert.deepEqual(recurrenceToDb("Weekly"), {
    frequency: "weekly",
    intervalCount: 1,
  });
  assert.deepEqual(recurrenceToDb("Fortnightly"), {
    frequency: "weekly",
    intervalCount: 2,
  });
  assert.deepEqual(recurrenceToDb("Four-weekly"), {
    frequency: "weekly",
    intervalCount: 4,
  });
  assert.deepEqual(recurrenceToDb("Monthly"), {
    frequency: "monthly",
    intervalCount: 1,
  });
});

test("nextScheduledIso: weekly and monthly keep Brisbane local time", () => {
  const start = dateKeyToIso("2026-09-11T09:00");
  assert.ok(start);
  const week = nextScheduledIso(start, "Weekly");
  const month = nextScheduledIso(start, "Monthly");
  const fortnight = nextScheduledIso(start, "Fortnightly");
  assert.ok(week && month && fortnight);
  assert.equal(dateKeyToIso("2026-09-18T09:00"), week);
  assert.equal(dateKeyToIso("2026-09-25T09:00"), fortnight);
  assert.equal(dateKeyToIso("2026-10-11T09:00"), month);
  assert.equal(nextScheduledIso(start, "One-off"), null);
});

test("buildNextDemoJob: completion of a weekly job creates the next visit", () => {
  const job: Job = {
    id: "job-1",
    displayName: "Harper · 11 Sep 2026",
    client: "Harper & Co",
    property: "Office",
    address: "1 Paperbark Street, Toowoomba",
    category: "Cleaning Services",
    scope: "Weekly tidy",
    date: "11 Sep 2026",
    time: "9:00 am",
    dateKey: "2026-09-11T09:00",
    status: "completed",
    notes: "",
    recurrence: "Weekly",
    assigneeIds: ["member-1"],
    assignees: ["Jodie"],
    photos: [],
  };
  const next = buildNextDemoJob(job, "job-2");
  assert.ok(next);
  assert.equal(next.id, "job-2");
  assert.equal(next.status, "scheduled");
  assert.equal(next.dateKey, "2026-09-18T09:00");
  assert.equal(next.recurrence, "Weekly");
  assert.equal(next.assigneeIds[0], "member-1");
  assert.equal(buildNextDemoJob({ ...job, status: "scheduled" }, "job-3"), null);
  assert.equal(buildNextDemoJob({ ...job, recurrence: "One-off" }, "job-3"), null);
});
