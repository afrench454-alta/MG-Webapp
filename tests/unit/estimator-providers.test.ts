import test from "node:test";
import assert from "node:assert/strict";

import {
  ESTIMATOR_NOT_CONNECTED,
  draftEstimateFromProvider,
  extractGeminiText,
  parseEstimatePayload,
  resolveEstimatorProvider,
  unwrapJsonPayload,
} from "../../src/features/console/data/estimator-providers";

const SAMPLE_ESTIMATE = {
  summary: "Standard lawn mow and edge of a suburban block.",
  assumptions: "Green waste left on the nature strip.",
  items: [
    { description: "Mow and edge", quantity: 1, unitLabel: "hrs", rate: 110 },
    { description: "Green waste handling", quantity: 1, unitLabel: "ea", rate: 25 },
  ],
};

test("resolveEstimatorProvider prefers Gemini over xAI", () => {
  assert.deepEqual(
    resolveEstimatorProvider({
      GEMINI_API_KEY: " gemini-live ",
      XAI_API_KEY: "xai-live",
    }),
    { kind: "gemini", apiKey: "gemini-live" },
  );
  assert.deepEqual(
    resolveEstimatorProvider({ GOOGLE_API_KEY: "google-alias" }),
    { kind: "gemini", apiKey: "google-alias" },
  );
  assert.deepEqual(resolveEstimatorProvider({ XAI_API_KEY: "xai-live" }), {
    kind: "xai",
    apiKey: "xai-live",
  });
  assert.equal(resolveEstimatorProvider({}), null);
});

test("parseEstimatePayload accepts fenced JSON from Gemini", () => {
  const parsed = parseEstimatePayload(
    `\`\`\`json\n${JSON.stringify(SAMPLE_ESTIMATE)}\n\`\`\``,
  );
  assert.equal(parsed?.items.length, 2);
  assert.equal(parsed?.items[0]?.rate, 110);
  assert.equal(unwrapJsonPayload("  {\"ok\":true}  "), "{\"ok\":true}");
});

test("extractGeminiText joins candidate parts", () => {
  const text = extractGeminiText({
    candidates: [
      {
        content: {
          parts: [{ text: '{"summary":' }, { text: '"ok"}' }],
        },
      },
    ],
  });
  assert.equal(text, '{"summary":"ok"}');
});

test("draftEstimateFromProvider uses Gemini when a Studio key is set", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(SAMPLE_ESTIMATE) }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await draftEstimateFromProvider(
    "Service: Yard Services\nScope:\nOvergrown backyard.",
    { GEMINI_API_KEY: "studio-key" },
    fetchImpl,
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.estimate.items[0]?.description, "Mow and edge");
  }
  assert.match(calls[0] ?? "", /gemini-2\.5-flash:generateContent$/);
});

test("draftEstimateFromProvider falls back to xAI and reports a missing key", async () => {
  const missing = await draftEstimateFromProvider("brief", {}, async () => {
    throw new Error("fetch should not run");
  });
  assert.deepEqual(missing, { ok: false, message: ESTIMATOR_NOT_CONNECTED });

  const result = await draftEstimateFromProvider(
    "Service: Cleaning Services\nScope:\nBond clean a 3-bed.",
    { XAI_API_KEY: "xai-key" },
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(SAMPLE_ESTIMATE) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  assert.equal(result.ok, true);
});
