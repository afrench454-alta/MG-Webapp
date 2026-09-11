import test from "node:test";
import assert from "node:assert/strict";

import {
  parseToolArguments,
  resolveJosephConfig,
} from "../../src/features/console/data/joseph-providers";

test("parseToolArguments: returns object payload", () => {
  assert.deepEqual(parseToolArguments('{"jobId":"abc","confirm":true}'), {
    jobId: "abc",
    confirm: true,
  });
});

test("parseToolArguments: invalid JSON becomes empty object", () => {
  assert.deepEqual(parseToolArguments("not-json"), {});
});

test("resolveJosephConfig: requires OpenRouter key", () => {
  assert.equal(resolveJosephConfig({}), null);
  const resolved = resolveJosephConfig({
    OPENROUTER_API_KEY: " sk-or-test ",
    OPENROUTER_MODEL: "openai/gpt-4o-mini",
  });
  assert.deepEqual(resolved, {
    apiKey: "sk-or-test",
    model: "openai/gpt-4o-mini",
  });
});
