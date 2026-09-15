import test from "node:test";
import assert from "node:assert/strict";

import {
  isConsoleTheme,
  oppositeTheme,
  THEME_STORAGE_KEY,
} from "../../src/features/console/theme";

test("theme helpers accept only light and dark", () => {
  assert.equal(isConsoleTheme("light"), true);
  assert.equal(isConsoleTheme("dark"), true);
  assert.equal(isConsoleTheme("system"), false);
  assert.equal(isConsoleTheme(""), false);
  assert.equal(THEME_STORAGE_KEY, "mg-console-theme");
});

test("oppositeTheme flips light and dark", () => {
  assert.equal(oppositeTheme("light"), "dark");
  assert.equal(oppositeTheme("dark"), "light");
});
