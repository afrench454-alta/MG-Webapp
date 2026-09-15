import test from "node:test";
import assert from "node:assert/strict";

import { JOSEPH_SUGGESTIONS, stripJosephWake } from "../../src/features/console/data/joseph-contract";
import {
  parseToolArguments,
  resolveJosephConfig,
} from "../../src/features/console/data/joseph-providers";

test("parseToolArguments: returns object payload", () => {
  assert.deepEqual(parseToolArguments('{\"jobId\":\"abc\",\"confirm\":true}'), {
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

test("stripJosephWake: drops Hey Joseph and bare Joseph", () => {
  assert.equal(stripJosephWake("Hey Joseph, what invoices are outstanding?"), "what invoices are outstanding?");
  assert.equal(stripJosephWake("Joseph mark job as completed"), "mark job as completed");
  assert.equal(stripJosephWake("What invoices are outstanding?"), "What invoices are outstanding?");
});

test("Joseph suggestions send a real prompt, not the short label", () => {
  assert.equal(JOSEPH_SUGGESTIONS.length, 3);
  for (const item of JOSEPH_SUGGESTIONS) {
    assert.ok(item.label.length > 0);
    assert.ok(item.prompt.length > item.label.length - 4);
    assert.notEqual(item.prompt, item.label);
  }
});

