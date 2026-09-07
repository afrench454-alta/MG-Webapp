"use server";

import { requireBusinessContext } from "@/lib/supabase/business";

import { estimateRequestSchema, type EstimateActionResult } from "./estimator-contract";
import { draftEstimateFromProvider } from "./estimator-providers";

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

  const { category, serviceDetail, address, scope } = parsed.data;
  const userPrompt = [
    `Service: ${category}${serviceDetail ? ` · ${serviceDetail}` : ""}`,
    address ? `Property: ${address}` : "Property: not supplied",
    `Scope:\n${scope}`,
  ].join("\n");

  try {
    return await draftEstimateFromProvider(userPrompt);
  } catch (error) {
    console.error("Estimate failed", error);
    return { ok: false, message: "The estimator could not complete. Try again." };
  }
}
