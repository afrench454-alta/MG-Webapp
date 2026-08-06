"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  type DeleteJobRequestActionResult,
  type JobRequestActionResult,
  jobRequestDraftSchema,
} from "./job-request-contract";
import { deleteJobRequest, saveJobRequest } from "./job-request-repository";

function safeActionMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return "The saved job request data was invalid.";
  if (error instanceof Error && /permission|owner|co-owner/i.test(error.message)) {
    return "You do not have permission to manage job requests.";
  }
  return fallback;
}

export async function saveJobRequestAction(input: unknown): Promise<JobRequestActionResult> {
  const parsed = jobRequestDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Check the request details and try again.",
    };
  }

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const request = await saveJobRequest(context, parsed.data);
    revalidatePath("/");
    return { ok: true, request };
  } catch (error) {
    console.error("Job request save failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The job request could not be saved. Try again."),
    };
  }
}

export async function deleteJobRequestAction(requestId: string): Promise<DeleteJobRequestActionResult> {
  const parsedId = z.uuid().safeParse(requestId);
  if (!parsedId.success) return { ok: false, message: "The job request identifier was invalid." };

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const deletedId = await deleteJobRequest(context, parsedId.data);
    revalidatePath("/");
    return { ok: true, requestId: deletedId };
  } catch (error) {
    console.error("Job request delete failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The job request could not be deleted. Try again."),
    };
  }
}
