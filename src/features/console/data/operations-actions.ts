"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  invoiceDraftSchema,
  invoicePaymentSchema,
  jobAssignmentsSchema,
  jobNoteSchema,
  jobUpdateSchema,
  quoteDraftSchema,
  quoteStatusUpdateSchema,
  scheduleJobSchema,
  type DeleteActionResult,
  type DeleteQuoteResult,
  type InvoiceActionResult,
  type JobActionResult,
  type JobPhotoActionResult,
  type QuoteActionResult,
} from "./operations-contract";
import {
  addJobNote,
  createInvoice,
  createQuote,
  deleteInvoice,
  deleteJob,
  deleteJobPhoto,
  deleteQuote,
  finalizeInvoice,
  getJob,
  markInvoiceAsSent,
  reviseQuote,
  scheduleJob,
  updateInvoice,
  updateInvoicePayment,
  updateJob,
  updateJobAssignments,
  updateQuote,
  updateQuoteStatus,
  uploadJobPhoto,
  voidIssuedInvoice,
} from "./operations-repository";
import { OperationsRuleError } from "./operations-rules";
import { getClientById } from "./client-repository";

function failure(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return "Check the details and try again.";
  if (error instanceof OperationsRuleError) return error.message;
  if (error instanceof Error) {
    if (/permission|owner|co-owner|authentication/i.test(error.message)) {
      return "You do not have permission to make this change.";
    }
    const cleaned = error.message.replace(/^.*error:\s*/i, "").split("\n")[0]?.trim();
    if (cleaned && cleaned.length < 240 && !/jwt|row-level|rls policy/i.test(cleaned)) {
      return cleaned;
    }
  }
  return fallback;
}

const idSchema = z.uuid();
const manager = () => requireBusinessContext(["owner", "co_owner"]);

export async function saveQuoteAction(input: unknown): Promise<QuoteActionResult> {
  const parsed = quoteDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Quote details are invalid." };
  try {
    const context = await manager();
    const quote = parsed.data.id
      ? await updateQuote(context, parsed.data)
      : await createQuote(context, parsed.data);
    const client = parsed.data.inlineClient && quote.clientId ? await getClientById(context, quote.clientId) : undefined;
    const job = parsed.data.directJobId ? await getJob(context, parsed.data.directJobId) : undefined;
    revalidatePath("/");
    return { ok: true, quote, client, job };
  } catch (error) {
    console.error("Quote save failed", error);
    return { ok: false, message: failure(error, "The quote could not be saved.") };
  }
}

export async function reviseQuoteAction(id: string): Promise<QuoteActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The quote identifier was invalid." };
  try {
    const quote = await reviseQuote(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, quote };
  } catch (error) {
    return { ok: false, message: failure(error, "The revision could not be created.") };
  }
}

export async function updateQuoteStatusAction(input: unknown): Promise<QuoteActionResult> {
  const parsed = quoteStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and review the quote before changing its status." };
  const { id, status, expectedUpdatedAt } = parsed.data;
  try {
    const quote = await updateQuoteStatus(await manager(), id, status, expectedUpdatedAt);
    revalidatePath("/");
    return { ok: true, quote };
  } catch (error) {
    return { ok: false, message: failure(error, "The quote could not be updated.") };
  }
}

export async function deleteQuoteAction(id: string): Promise<DeleteQuoteResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The quote identifier was invalid." };
  try {
    const deleted = await deleteQuote(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, ...deleted };
  } catch (error) {
    return { ok: false, message: failure(error, "The quote could not be deleted.") };
  }
}

export async function scheduleJobAction(input: unknown): Promise<JobActionResult> {
  const parsed = scheduleJobSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Schedule details are invalid." };
  try {
    const context = await manager();
    const job = await scheduleJob(context, parsed.data);
    const client = parsed.data.inlineClient && job.clientId ? await getClientById(context, job.clientId) : undefined;
    revalidatePath("/");
    return { ok: true, job, client };
  } catch (error) {
    return { ok: false, message: failure(error, "The job could not be scheduled.") };
  }
}

export async function updateJobAction(input: unknown): Promise<JobActionResult> {
  const parsed = jobUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: failure(parsed.error, "Job details are invalid.") };
  try {
    const { job, nextJob } = await updateJob(await requireBusinessContext(), parsed.data);
    revalidatePath("/");
    return { ok: true, job, nextJob };
  } catch (error) {
    return { ok: false, message: failure(error, "The job could not be updated.") };
  }
}

export async function deleteJobAction(id: string): Promise<DeleteActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The job identifier was invalid." };
  try {
    const deletedId = await deleteJob(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, id: deletedId };
  } catch (error) {
    return { ok: false, message: failure(error, "The job could not be deleted.") };
  }
}

export async function updateJobAssignmentsAction(input: unknown): Promise<JobActionResult> {
  const parsed = jobAssignmentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The assignment selection was invalid." };
  try {
    const job = await updateJobAssignments(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, job };
  } catch (error) {
    return { ok: false, message: failure(error, "The job assignments could not be saved.") };
  }
}

export async function addJobNoteAction(input: unknown): Promise<JobActionResult> {
  const parsed = jobNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "The note is invalid." };
  try {
    const job = await addJobNote(await requireBusinessContext(), parsed.data);
    revalidatePath("/");
    return { ok: true, job };
  } catch (error) {
    return { ok: false, message: failure(error, "The field note could not be saved.") };
  }
}

export async function uploadJobPhotoAction(formData: FormData): Promise<JobPhotoActionResult> {
  const jobId = idSchema.safeParse(formData.get("jobId"));
  const caption = z.string().trim().max(500).safeParse(formData.get("caption") || "");
  const file = formData.get("photo");
  if (
    !jobId.success ||
    !caption.success ||
    !(file instanceof File) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024
  ) {
    return { ok: false, message: "Choose a JPG, PNG or WebP photo up to 10 MB." };
  }
  try {
    const photo = await uploadJobPhoto(await requireBusinessContext(), jobId.data, file, caption.data);
    revalidatePath("/");
    return { ok: true, photo };
  } catch (error) {
    return { ok: false, message: failure(error, "The photo could not be uploaded.") };
  }
}

export async function deleteJobPhotoAction(jobId: string, photoId: string): Promise<DeleteActionResult> {
  const parsedJobId = idSchema.safeParse(jobId);
  const parsedPhotoId = idSchema.safeParse(photoId);
  if (!parsedJobId.success || !parsedPhotoId.success) return { ok: false, message: "The photo identifier was invalid." };
  try {
    const deletedId = await deleteJobPhoto(await requireBusinessContext(), parsedJobId.data, parsedPhotoId.data);
    revalidatePath("/");
    return { ok: true, id: deletedId };
  } catch (error) {
    return { ok: false, message: failure(error, "The photo could not be deleted.") };
  }
}

export async function saveInvoiceAction(input: unknown): Promise<InvoiceActionResult> {
  const parsed = invoiceDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invoice details are invalid." };
  try {
    const context = await manager();
    const invoice = parsed.data.id
      ? await updateInvoice(context, parsed.data)
      : await createInvoice(context, parsed.data);
    revalidatePath("/");
    const client = parsed.data.inlineClient && invoice.clientId ? await getClientById(context, invoice.clientId) : undefined;
    return { ok: true, invoice, client };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be saved.") };
  }
}

export async function updateInvoicePaymentAction(input: unknown): Promise<InvoiceActionResult> {
  const parsed = invoicePaymentSchema.safeParse(input);
  if (!parsed.success || !idSchema.safeParse(parsed.data.invoiceId).success) {
    return { ok: false, message: "Check the amount, date, method and any correction details." };
  }
  try {
    const invoice = await updateInvoicePayment(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, invoice };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be updated.") };
  }
}

export async function finalizeInvoiceAction(id: string, expectedVersion: number): Promise<InvoiceActionResult> {
  const parsed = z.tuple([idSchema, z.number().int().positive()]).safeParse([id, expectedVersion]);
  if (!parsed.success) return { ok: false, message: "Reload the invoice before issuing." };
  try {
    const invoice = await finalizeInvoice(await manager(), ...parsed.data);
    revalidatePath("/");
    return { ok: true, invoice };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be finalized.") };
  }
}

export async function markInvoiceSentAction(id: string): Promise<InvoiceActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The invoice identifier was invalid." };
  try {
    const invoice = await markInvoiceAsSent(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, invoice };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be marked sent.") };
  }
}

export async function voidInvoiceAction(id: string): Promise<InvoiceActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The invoice identifier was invalid." };
  try {
    const invoice = await voidIssuedInvoice(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, invoice };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be voided.") };
  }
}

export async function deleteInvoiceAction(id: string): Promise<DeleteActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "The invoice identifier was invalid." };
  try {
    const deletedId = await deleteInvoice(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, id: deletedId };
  } catch (error) {
    return { ok: false, message: failure(error, "The invoice could not be deleted.") };
  }
}
