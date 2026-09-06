"use server";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  estimateRequestSchema,
  estimateResultSchema,
  type EstimateActionResult,
} from "./estimator-contract";

const SYSTEM_PROMPT = `You are the quoting assistant for Mow & Glow Property Services, a field-ops business in regional Queensland (Toowoomba / Kingaroy and nearby).

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

export async function estimateJobAction(
  input: unknown,
): Promise<EstimateActionResult> {
  const parsed = estimateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Describe the job in a bit more detail so a quote can be drafted.",
    };
  }

  try {
    await requireBusinessContext(["owner", "co_owner"]);
  } catch {
    return { ok: false, message: "Sign in as an owner or co-owner to estimate." };
  }

  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "AI quoting is not connected on this deployment yet. You can still build the quote by hand.",
    };
  }

  const { category, serviceDetail, address, scope } = parsed.data;
  const userPrompt = [
    `Service: ${category}${serviceDetail ? ` · ${serviceDetail}` : ""}`,
    address ? `Property: ${address}` : "Property: not supplied",
    `Scope:\n${scope}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, message: "The estimator is briefly unavailable. Try again." };
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, message: "The estimator returned an empty draft." };
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return { ok: false, message: "The estimator draft could not be read. Try again." };
    }

    const estimate = estimateResultSchema.safeParse(json);
    if (!estimate.success) {
      return { ok: false, message: "The estimator draft was incomplete. Try again." };
    }

    return { ok: true, estimate: estimate.data };
  } catch (error) {
    console.error("Estimate failed", error);
    return { ok: false, message: "The estimator could not complete. Try again." };
  }
}
