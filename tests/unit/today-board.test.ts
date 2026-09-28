import test from "node:test";
import assert from "node:assert/strict";

import type { Invoice, Job } from "../../src/features/console/domain";
import {
  brisbaneDayKey,
  buildJosephSnapshot,
  jobDayKey,
  jobsOnDay,
  shiftDayKey,
} from "../../src/features/console/data/today-board";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    displayName: "Northside",
    client: "Northside Studio",
    property: "Studio",
    address: "4 Railway Terrace",
    category: "Mowing",
    scope: "Front and back",
    date: "29 Sep 2026",
    time: "8:00 am",
    dateKey: "2026-09-29T08:00",
    status: "scheduled",
    notes: "",
    recurrence: "One-off",
    assigneeIds: ["tech-1"],
    assignees: ["Sam"],
    photos: [],
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    documentNumber: "INV-1",
    client: "Northside Studio",
    address: "4 Railway Terrace",
    issued: "29 Sep 2026",
    due: "06 Oct 2026",
    dueDate: "2026-10-06",
    documentStatus: "Issued",
    paymentStatus: "Unpaid",
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 80 }],
    ...overrides,
  };
}

test("shiftDayKey moves calendar days without using local TZ", () => {
  assert.equal(shiftDayKey("2026-09-29", 1), "2026-09-30");
  assert.equal(shiftDayKey("2026-09-30", -1), "2026-09-29");
  assert.equal(shiftDayKey("2026-09-30", 1), "2026-10-01");
});

test("jobDayKey uses the Brisbane calendar prefix of dateKey", () => {
  assert.equal(jobDayKey(job()), "2026-09-29");
});

test("jobsOnDay filters by day and technician assignment", () => {
  const jobs = [
    job({ id: "a", dateKey: "2026-09-29T08:00", assigneeIds: ["tech-1"] }),
    job({ id: "b", dateKey: "2026-09-29T10:00", assigneeIds: ["tech-2"] }),
    job({ id: "c", dateKey: "2026-09-30T08:00", assigneeIds: ["tech-1"] }),
    job({ id: "d", dateKey: "2026-09-29T09:00", status: "completed", assigneeIds: ["tech-1"] }),
  ];

  const ownerDay = jobsOnDay(jobs, "2026-09-29");
  assert.deepEqual(
    ownerDay.map((item) => item.id),
    ["a", "d", "b"],
  );

  const techDay = jobsOnDay(jobs, "2026-09-29", {
    actorId: "tech-1",
    actorRole: "technician",
  });
  assert.deepEqual(
    techDay.map((item) => item.id),
    ["a", "d"],
  );
});

test("buildJosephSnapshot lists live ids and hides invoices from technicians", () => {
  const snapshot = buildJosephSnapshot({
    jobs: [job({ id: "11111111-1111-4111-8111-111111111111" })],
    invoices: [invoice({ id: "22222222-2222-4222-8222-222222222222" })],
    actorRole: "owner",
    now: new Date("2026-09-29T00:00:00+10:00"),
  });
  assert.match(snapshot, /2026-09-29/);
  assert.match(snapshot, /11111111-1111-4111-8111-111111111111/);
  assert.match(snapshot, /22222222-2222-4222-8222-222222222222/);
  assert.match(snapshot, /do not invent records/);

  const tech = buildJosephSnapshot({
    jobs: [job()],
    invoices: [invoice()],
    actorId: "tech-1",
    actorRole: "technician",
    now: new Date("2026-09-29T00:00:00+10:00"),
  });
  assert.match(tech, /hidden for technicians/);
});

test("brisbaneDayKey is a YYYY-MM-DD calendar date", () => {
  assert.match(brisbaneDayKey(new Date("2026-09-28T16:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});
