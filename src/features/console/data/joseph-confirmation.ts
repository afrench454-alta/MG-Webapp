import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";
import { invoiceTerms, money } from "../domain";
import type { JosephProposal } from "./joseph-contract";
import { stripJobOpsSentinel } from "./joseph-next-stop";
import { parseToolArguments } from "./joseph-providers";
import { jobUpdateSchema, quoteDraftSchema } from "./operations-contract";

export const josephMutationName = z.enum([
  "update_job_status",
  "complete_job_and_draft_invoice",
  "create_quote_from_request",
]);

type MutationName = z.infer<typeof josephMutationName>;

const jobProposalSchema = z.object({
  jobId: z.uuid(),
  status: jobUpdateSchema.shape.status,
  notes: jobUpdateSchema.shape.notes.optional(),
});

const jobInvoiceSchema = z.object({
  jobId: z.uuid(),
  rate: z.number().min(0).max(10_000_000).optional(),
});

const quoteProposalSchema = z.object({
  jobRequestId: z.uuid(),
  scope: quoteDraftSchema.shape.scope,
  items: quoteDraftSchema.shape.items,
});

const preparedSchema = z.object({
  token: z.uuid(),
  title: z.string(),
  client: z.string(),
  address: z.string().optional(),
  targetLabel: z.string(),
  recurring: z.boolean(),
  clearsSchedule: z.boolean().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
  draft: z.object({
    scope: z.string(),
    items: quoteDraftSchema.shape.items,
    issueDate: z.iso.date(),
    validUntil: z.iso.date().optional(),
    dueDate: z.iso.date().optional(),
    notes: z.string().optional(),
  }).optional(),
});

function proposalDetails(prepared: z.infer<typeof preparedSchema>): string[] {
  const details = [[prepared.targetLabel, prepared.client, prepared.address].filter(Boolean).join(" · ")];
  if (prepared.status) details.push(`Job status: ${prepared.status.replaceAll("_", " ").replace("paused", "on hold")}`);
  if (prepared.clearsSchedule) details.push("The scheduled date and time will be cleared.");
  if (prepared.status === "completed" && prepared.recurring) {
    details.push("Completing this recurring job can schedule the next visit.");
  }
  if (prepared.notes !== undefined) {
    const notes = stripJobOpsSentinel(prepared.notes);
    details.push(notes ? `Job notes: ${notes}` : "Job notes will be empty.");
  }
  const draft = prepared.draft;
  if (draft) {
    details.push(`Scope: ${draft.scope}`, `Issue date: ${draft.issueDate}`);
    if (draft.dueDate) details.push(`Due date: ${draft.dueDate}`);
    if (draft.validUntil) details.push(`Valid until: ${draft.validUntil}`);
    for (const item of draft.items) {
      const description = item.label ? `${item.label} · ${item.description}` : item.description;
      details.push(`${description} · ${item.quantity} ${item.unitLabel || "item"} × ${money(item.rate)}`);
    }
    if (draft.notes) details.push(`Invoice notes: ${draft.notes}`);
  }
  return details;
}

export async function proposeJosephMutation(
  context: BusinessContext,
  name: MutationName,
  rawArgs: string,
  nextStop?: { chip: "on-my-way" | "running-late" | "done-draft-invoice"; quoteId: string | null },
): Promise<JosephProposal> {
  if (name !== "update_job_status" && context.role === "technician") {
    throw new Error("Only owners and co-owners can draft quotes or invoices.");
  }

  const args = parseToolArguments(rawArgs);
  const payload =
    name === "update_job_status" ? jobProposalSchema.parse(args)
      : name === "complete_job_and_draft_invoice" ? jobInvoiceSchema.parse(args)
      : quoteProposalSchema.parse(args);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_joseph_action", {
    target_business_id: context.businessId,
    action_name: name,
    args: { ...payload, ...(nextStop ? { nextStop } : {}), invoiceNotes: invoiceTerms },
  });
  if (error) throw new Error(error.message);
  const prepared = preparedSchema.parse(data);
  return { token: prepared.token, title: prepared.title, details: proposalDetails(prepared) };
}
