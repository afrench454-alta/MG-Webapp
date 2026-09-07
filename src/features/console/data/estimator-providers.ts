import {
  estimateResultSchema,
  type EstimateActionResult,
  type EstimateResult,
} from "./estimator-contract";

export const ESTIMATOR_NOT_CONNECTED =
  "AI quoting is not connected on this deployment yet. You can still build the quote by hand.";
export const ESTIMATOR_UNAVAILABLE =
  "The estimator is briefly unavailable. Try again.";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

export const ESTIMATOR_SYSTEM_PROMPT = `You are the quoting assistant for Mow & Glow Property Services, a field-ops business in regional Queensland (Toowoomba / Kingaroy and nearby).

Return JSON only with this shape:
{
  "summary": "one-paragraph scope summary the client can read",
  "assumptions": "short list of assumptions or extras to confirm",
  "items": [
    { "description": "line item", "quantity": 1, "unitLabel": "hrs" | "ea", "rate": 120 }
  ]
}

Rules:
- Currency is AUD. The business is not registered for GST, so do not add GST.
- Use realistic 2026 SEQ/Darling Downs rates. Labour is typically $90–140 per hour. Bond/end-of-lease cleans are usually a flat property price. Yard work is often hours or a site rate.
- Prefer 2–6 line items. Combine trivial materials into labour unless they are a distinct charge.
- If the brief is thin, estimate a conservative mid-range and say so in assumptions.
- Never invent a client name. Never mention other brands.`;

export type EstimatorEnv = {
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  XAI_API_KEY?: string;
};

export type EstimatorProvider =
  | { kind: "gemini"; apiKey: string }
  | { kind: "xai"; apiKey: string };

function envValue(env: object, key: keyof EstimatorEnv): string {
  const value = (env as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveEstimatorProvider(
  env: object = process.env,
): EstimatorProvider | null {
  const gemini = envValue(env, "GEMINI_API_KEY") || envValue(env, "GOOGLE_API_KEY");
  if (gemini) {
    return { kind: "gemini", apiKey: gemini };
  }
  const xai = envValue(env, "XAI_API_KEY");
  if (xai) {
    return { kind: "xai", apiKey: xai };
  }
  return null;
}

export function unwrapJsonPayload(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseEstimatePayload(content: string): EstimateResult | null {
  try {
    const json: unknown = JSON.parse(unwrapJsonPayload(content));
    const parsed = estimateResultSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function extractGeminiText(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const first = candidates[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const parts = (first as { content?: { parts?: unknown } }).content?.parts;
  if (!Array.isArray(parts)) {
    return null;
  }
  const text = parts
    .map((part) =>
      part && typeof part === "object" && "text" in part && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("")
    .trim();
  return text || null;
}

export function extractXaiText(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return null;
  }
  const content = (first as { message?: { content?: unknown } }).message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

type FetchLike = typeof fetch;

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function requestGeminiDraft(
  apiKey: string,
  userPrompt: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ESTIMATOR_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (response.status === 404) {
      continue;
    }
    if (!response.ok) {
      return null;
    }
    return extractGeminiText(await readJson(response));
  }
  return null;
}

async function requestXaiDraft(
  apiKey: string,
  userPrompt: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  const response = await fetchImpl("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ESTIMATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }
  return extractXaiText(await readJson(response));
}

export async function draftEstimateFromProvider(
  userPrompt: string,
  env: object = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<EstimateActionResult> {
  const provider = resolveEstimatorProvider(env);
  if (!provider) {
    return { ok: false, message: ESTIMATOR_NOT_CONNECTED };
  }

  const content =
    provider.kind === "gemini"
      ? await requestGeminiDraft(provider.apiKey, userPrompt, fetchImpl)
      : await requestXaiDraft(provider.apiKey, userPrompt, fetchImpl);

  if (!content) {
    return { ok: false, message: ESTIMATOR_UNAVAILABLE };
  }

  const estimate = parseEstimatePayload(content);
  if (!estimate) {
    return {
      ok: false,
      message: "The estimator draft was incomplete. Try again.",
    };
  }

  return { ok: true, estimate };
}
