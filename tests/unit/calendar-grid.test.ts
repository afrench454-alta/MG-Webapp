import test from "node:test";
import assert from "node:assert/strict";

import {
  WEEKDAY_LABELS,
  mondayLeadingBlanks,
  monthCells,
  padMonthDay,
} from "../../src/features/console/data/calendar-grid";

test("Australian calendar weeks start on Monday", () => {
  assert.deepEqual([...WEEKDAY_LABELS], [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);
});

test("September 2026 starts on Tuesday so Monday is a leading blank", () => {
  // 1 Sep 2026 is a Tuesday.
  assert.equal(mondayLeadingBlanks(2026, 8), 1);
  const cells = monthCells(2026, 8);
  assert.equal(cells[0], null);
  assert.equal(cells[1], 1);
  assert.equal(cells[30], 30);
  assert.equal(padMonthDay(2026, 8, 16), "2026-09-16");
});

test("monthCells pads to full weeks", () => {
  const cells = monthCells(2026, 8);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter(Boolean).length, 30);
});
