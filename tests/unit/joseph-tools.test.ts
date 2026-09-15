import test from "node:test";
import assert from "node:assert/strict";

import {
  JOSEPH_SUGGESTIONS,
  argumentsWithConfirm,
  stripJosephWake,
} from "../../src/features/console/data/joseph-contract";
import {
  parseToolArguments,
  resolveJosephConfig,
} from "../../src/features/console/data/joseph-providers";
import {
  brisbaneToday,
  formatJosephSnapshot,
  jobOnIsoDate,
  josephSystemPrompt,
  lastAcceptedQuoteBrief,
} from "../../src/features/console/data/joseph-ops";
import type { Quote } from "../../src/features/console/domain";

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

test("jobOnIsoDate: matches dateKey day in Brisbane calendar", () => {
  assert.equal(
    jobOnIsoDate({ date: "Tue 16 Sep", dateKey: "2026-09-16T09:00" }, "2026-09-16"),
    true,
  );
  assert.equal(
    jobOnIsoDate({ date: "Tue 16 Sep", dateKey: "2026-09-16T09:00" }, "2026-09-17"),
    false,
  );
});

test("brisbaneToday: returns YYYY-MM-DD", () => {
  assert.match(brisbaneToday(new Date("2026-09-15T16:00:00.000Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("formatJosephSnapshot: lists jobs and overdue for owners", () => {
  const text = formatJosephSnapshot({
    today: "2026-09-16",
    jobs: [
      { client: "Smith", time: "9:00 am", status: "scheduled", category: "Mowing" },
    ],
    overdueCount: 2,
  });
  assert.match(text, /2026-09-16/);
  assert.match(text, /Smith/);
  assert.match(text, /Overdue invoices: 2/);
});

test("formatJosephSnapshot: techs do not see invoice counts", () => {
  const text = formatJosephSnapshot({
    today: "2026-09-16",
    jobs: [],
    overdueCount: null,
  });
  assert.match(text, /No jobs dated today/);
  assert.doesNotMatch(text, /Overdue invoices/);
});

test("argumentsWithConfirm: forces confirm true and does not write without it", () => {
  const withConfirm = JSON.parse(argumentsWithConfirm('{"jobId":"11111111-1111-4111-8111-111111111111"}')) as {
    confirm: boolean;
    jobId: string;
  };
  assert.equal(withConfirm.confirm, true);
  assert.equal(withConfirm.jobId, "11111111-1111-4111-8111-111111111111");
  const empty = JSON.parse(argumentsWithConfirm("not-json")) as { confirm: boolean };
  assert.equal(empty.confirm, true);
});

test("lastAcceptedQuoteBrief: prefers matching property", () => {
  const quotes: Quote[] = [
    {
      id: "q1",
      documentNumber: "Q-100",
      clientId: "c1",
      serviceAddressId: "p1",
      client: "Smith",
      address: "12 Oak St Kingaroy",
      issued: "2026-08-01",
      expires: "2026-08-15",
      validDays: 14,
      status: "Accepted",
      scope: "Mow and edge",
      clientNotes: "",
      items: [{ description: "Mowing", quantity: 1, rate: 85 }],
    },
    {
      id: "q2",
      documentNumber: "Q-101",
      clientId: "c2",
      serviceAddressId: "p2",
      client: "Jones",
      address: "9 Pine St",
      issued: "2026-08-02",
      expires: "2026-08-16",
      validDays: 14,
      status: "Accepted",
      scope: "Clean",
      clientNotes: "",
      items: [{ description: "Clean", quantity: 1, rate: 220 }],
    },
  ];
  const brief = lastAcceptedQuoteBrief(quotes, { propertyId: "p1", clientId: "c1" });
  assert.ok(brief);
  assert.match(brief ?? "", /Q-100/);
  assert.match(brief ?? "", /85/);
  assert.equal(lastAcceptedQuoteBrief(quotes, { propertyId: "none" }), null);
});

test("josephSystemPrompt: keeps the five van phrases", () => {
  const prompt = josephSystemPrompt("owner", "Live board for 2026-09-16");
  assert.match(prompt, /Job complete, draft invoice/);
  assert.match(prompt, /Help draft a quote/);
  assert.match(prompt, /Mark job as/);
  assert.match(prompt, /invoices are outstanding/);
  assert.match(prompt, /Send a message to/);
  assert.match(prompt, /What's on today/);
  assert.match(prompt, /Live board for 2026-09-16/);
});
