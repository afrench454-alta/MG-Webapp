import test from "node:test";
import assert from "node:assert/strict";

import {
  displayServiceCategory,
  displayServiceDetail,
  formatServiceTitle,
  parseServiceTitle,
  detailsForCategory,
  summarizeServiceCategory,
} from "../../src/features/console/data/service-catalog";

test("new jobs store the three main services, with optional type", () => {
  assert.equal(formatServiceTitle("Cleaning Services"), "Cleaning Services");
  assert.equal(
    formatServiceTitle("Cleaning Services", "Bond Clean"),
    "Cleaning Services · Bond Clean",
  );
  assert.deepEqual(detailsForCategory("Cleaning Services"), [
    "Bond Clean",
    "General Clean",
    "End of Lease",
    "Deep Clean",
  ]);
  assert.equal(
    summarizeServiceCategory("Cleaning Services"),
    "Bond Clean + General Clean + End of Lease + Deep Clean",
  );
});

test("legacy service titles still display as the new main services", () => {
  assert.equal(displayServiceCategory("Standard / General Clean"), "Cleaning Services");
  assert.equal(displayServiceCategory("Bond Clean / End of Lease"), "Cleaning Services");
  assert.equal(displayServiceDetail("Bond Clean / End of Lease"), "Bond Clean");
  assert.equal(displayServiceCategory("Yard Cleanup"), "Yard Services");
  assert.equal(
    parseServiceTitle("Cleaning Services · Bond Clean").detail,
    "Bond Clean",
  );
});
