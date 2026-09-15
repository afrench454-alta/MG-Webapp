"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  type ClientActionResult,
  type ClientArchiveResult,
  type ClientImportCommitResult,
  type ClientImportPreviewResult,
  clientImportTextSchema,
  clientMutationSchema,
} from "./client-contract";
import {
  parseClientImportText,
  planClientImport,
} from "./client-import";
import {
  archiveClient,
  listClients,
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

export async function previewClientImportAction(
  input: unknown,
): Promise<ClientImportPreviewResult> {
  const parsed = clientImportTextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid clients JSON file." };
  }

  const extracted = parseClientImportText(parsed.data.jsonText);
  if (!extracted.ok) return extracted;

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const existing = await listClients(context);
    return { ok: true, plan: planClientImport(extracted.records, existing) };
  } catch (error) {
    console.error("Client import preview failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The import could not be checked. Try again."),
    };
  }
}

export async function commitClientImportAction(
  input: unknown,
): Promise<ClientImportCommitResult> {
  const parsed = clientImportTextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Choose a valid clients JSON file." };
  }

  const extracted = parseClientImportText(parsed.data.jsonText);
  if (!extracted.ok) return extracted;

  try {
    const context = await requireBusinessContext(["owner", "co_owner"]);
    const existing = await listClients(context);
    const plan = planClientImport(extracted.records, existing);
    const created = [];
    const failed: Array<{ name: string; message: string }> = [];
    const known = [...existing];

    for (const row of plan.rows) {
      if (row.decision !== "create" || !row.payload) continue;
      const stillNew = !planClientImport([row.payload], known).rows.some(
        (item) => item.decision === "skip",
      );
      if (!stillNew) continue;

      try {
        const client = await saveClient(context, row.payload);
        created.push(client);
        known.push(client);
      } catch (error) {
        console.error("Client import row failed", error);
        failed.push({
          name: row.name,
          message: safeActionMessage(error, "This client could not be saved."),
        });
      }
    }

    if (created.length > 0) revalidatePath("/");

    return {
      ok: true,
      created,
      skipped: plan.skipCount,
      failed,
    };
  } catch (error) {
    console.error("Client import commit failed", error);
    return {
      ok: false,
      message: safeActionMessage(error, "The import could not be saved. Try again."),
    };
  }
}
