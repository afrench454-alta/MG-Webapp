"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  type ClientActionResult,
  type ClientArchiveResult,
  clientMutationSchema,
} from "./client-contract";
import {
  archiveClient,
  saveClient,
} from "./client-repository";

const clientIdSchema = z.uuid();

function safeActionMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return "The saved client data was invalid.";
  if (error instanceof Error && /permission|owner|co-owner/i.test(error.message)) {
    return "You do not have permission to manage clients.";
  }
  return fallback;
}

export async function saveClientAction(
  input: unknown,
): Promise<ClientActionResult> {
  const parsed = clientMutationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Check the client details and try again.",
    };
  }

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const client = await saveClient(context, parsed.data);
    revalidatePath("/");
    return { ok: true, client };
  } catch (error) {
    console.error("Client save failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The client could not be saved. Try again."),
    };
  }
}

export async function archiveClientAction(
  clientId: string,
): Promise<ClientArchiveResult> {
  const parsedId = clientIdSchema.safeParse(clientId);
  if (!parsedId.success) return { ok: false, message: "This client id is invalid." };

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const archivedId = await archiveClient(context, parsedId.data);
    revalidatePath("/");
    return { ok: true, clientId: archivedId };
  } catch (error) {
    console.error("Client archive failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The client could not be archived. Try again."),
    };
  }
}
