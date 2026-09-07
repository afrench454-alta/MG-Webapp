import test from "node:test";
import assert from "node:assert/strict";

import {
  ESTIMATOR_NOT_CONNECTED,
  ESTIMATOR_UNAUTHORIZED,
  GEMINI_MODELS,
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

test("Gemini model list prefers current Flash models over shutdown 2.0", () => {
  assert.equal(GEMINI_MODELS[0], "gemini-3.8-flash");
  assert.ok(GEMINI_MODELS.includes("gemini-3.5-flash"));
  assert.equal(
    (GEMINI_MODELS as readonly string[]).includes("gemini-2.0-flash"),
    false,
  );
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
  assert.match(calls[0] ?? "", /gemini-3\.8-flash:generateContent$/);
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

test("draftEstimateFromProvider reports a rejected Gemini key", async () => {
  const result = await draftEstimateFromProvider(
    "Service: Yard Services\nScope:\nOvergrown backyard.",
    { GEMINI_API_KEY: "bad-key" },
    async () => new Response("denied", { status: 401 }),
  );
  assert.deepEqual(result, { ok: false, message: ESTIMATOR_UNAUTHORIZED });
});

test("draftEstimateFromProvider skips a retired Gemini model and uses the next one", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    if (String(input).includes("gemini-3.8-flash")) {
      return new Response("not found", { status: 404 });
    }
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
  assert.match(calls[0] ?? "", /gemini-3\.8-flash/);
  assert.match(calls[1] ?? "", /gemini-3\.5-flash/);
});
