import test from "node:test";
import assert from "node:assert/strict";

import {
  findAssignmentConflicts,
  findSiteConflict,
} from "../../src/features/console/data/schedule-planning";

const members = [
  { id: "alex", name: "Alex" },
  { id: "sam", name: "Sam" },
];

const booie = {
  id: "job-1",
  dateKey: "2026-08-11T09:00",
  assigneeIds: ["alex"],
  client: "Northside Studio",
  address: "7 McCauley Drive, Booie",
  status: "scheduled",
};

const railway = {
  id: "job-2",
  dateKey: "2026-08-11T09:00",
  assigneeIds: ["sam"],
  client: "Northside Studio",
  address: "4 Railway Terrace, Kingaroy",
  status: "scheduled",
};

test("same client, same time, different properties is not a site conflict", () => {
  assert.equal(
    findSiteConflict({
      jobs: [booie],
      scheduledStart: "2026-08-11T09:00",
      address: "4 Railway Terrace, Kingaroy",
    }),
    null,
  );
});

test("same property at the same time is a site conflict", () => {
  assert.match(
    findSiteConflict({
      jobs: [booie],
      scheduledStart: "2026-08-11T09:00",
      address: "7 McCauley Drive, Booie",
    }) || "",
    /7 McCauley Drive/,
  );
});

test("a team member cannot be booked on two jobs in the same slot", () => {
  const conflicts = findAssignmentConflicts({
    jobs: [booie, railway],
    scheduledStart: "2026-08-11T09:00",
    profileIds: ["alex"],
    members,
  });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.name, "Alex");
  assert.match(conflicts[0]?.otherLabel || "", /Booie/);
});

test("completed jobs do not count as conflicts", () => {
  assert.deepEqual(
    findAssignmentConflicts({
      jobs: [{ ...booie, status: "completed" }],
      scheduledStart: "2026-08-11T09:00",
      profileIds: ["alex"],
      members,
    }),
    [],
  );
});
