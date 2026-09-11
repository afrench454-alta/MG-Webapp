import "server-only";

import { z } from "zod";

import { formatMemberDisplayName } from "@/lib/brand";
import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { Invoice, Job, JobPhoto, Quote, TeamMember } from "../domain";
import type { InvoiceDraftInput, JobAssignmentsInput, JobUpdateInput, QuoteDraftInput, ScheduleJobInput } from "./operations-contract";
import {
  isRepeatingRecurrence,
  nextScheduledIso,
  recurrenceToDb,
} from "./job-recurrence";
import {
  mapInvoiceDocumentStatus,
  mapInvoicePaymentStatus,
  mapJobStatus,
  mapQuoteStatus,
} from "./operations-map";
import {
  assertInvoiceCanBeDeleted,
  assertInvoiceCanBeEdited,
  assertJobCanBeDeleted,
  assertQuoteCanBeEdited,
  invoiceCreateRpcArgs,
} from "./operations-rules";
import { formatJobDisplayName } from "./work-identity";
import {
  applyInvoicePayment,
  finalizeInvoiceRecord,
  markInvoiceSent,
  planInvoicePaymentRecords,
  toDbDocumentStatus,
  voidInvoice,
} from "./invoice-lifecycle";

const itemSchema = z.object({ label: z.string().nullable().optional(), description: z.string(), quantity: z.coerce.number(), unit_label: z.string().optional(), unit_price: z.coerce.number(), tax_rate: z.coerce.number().optional() });
const clientRowSchema = z.object({ id: z.uuid(), display_name: z.string() });
const addressRowSchema = z.object({ id: z.uuid(), label: z.string(), line_1: z.string() });
const profileRowSchema = z.object({ id: z.uuid(), display_name: z.string().nullable(), email: z.string().nullable(), role: z.enum(["owner", "co_owner", "technician"]) });
const assignmentRowSchema = z.object({ job_id: z.uuid(), profile_id: z.uuid(), is_lead: z.boolean() });
const attachmentRowSchema = z.object({ id: z.uuid(), job_id: z.uuid(), storage_bucket: z.string(), storage_path: z.string(), original_filename: z.string(), caption: z.string().nullable(), created_at: z.string() });
const quoteItemRowSchema = itemSchema.extend({ quote_id: z.uuid() });
const invoiceItemRowSchema = itemSchema.extend({ invoice_id: z.uuid() });
const recurrenceRowSchema = z.object({ job_id: z.uuid(), frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]), interval_count: z.number() });
const quoteRowSchema = z.object({ id: z.uuid(), client_id: z.uuid(), service_address_id: z.uuid().nullable(), job_request_id: z.uuid().nullable(), document_number: z.string().nullable(), status: z.enum(["draft", "sent", "approved", "declined", "expired", "void"]), title: z.string(), issue_date: z.string(), valid_until: z.string().nullable(), customer_message: z.string().nullable(), internal_notes: z.string().nullable() });
const jobRowSchema = z.object({ id: z.uuid(), client_id: z.uuid(), service_address_id: z.uuid().nullable(), job_request_id: z.uuid().nullable(), status: z.enum(["unscheduled", "scheduled", "in_progress", "paused", "completed", "cancelled"]), title: z.string(), scope_of_work: z.string().nullable(), internal_instructions: z.string().nullable(), scheduled_start: z.string().nullable() });
const invoiceRowSchema = z.object({ id: z.uuid(), client_id: z.uuid(), billing_address_id: z.uuid().nullable(), job_id: z.uuid().nullable(), quote_id: z.uuid().nullable(), document_number: z.string().nullable(), document_status: z.string(), payment_status: z.string(), title: z.string(), issue_date: z.string(), due_date: z.string().nullable(), payment_instructions: z.string().nullable(), internal_notes: z.string().nullable() });

const QUOTE_SELECT = "id, client_id, service_address_id, job_request_id, document_number, status, title, issue_date, valid_until, customer_message, internal_notes";
const JOB_SELECT = "id, client_id, service_address_id, job_request_id, status, title, scope_of_work, internal_instructions, scheduled_start";
const INVOICE_SELECT = "id, client_id, billing_address_id, job_id, quote_id, document_number, document_status, payment_status, title, issue_date, due_date, payment_instructions, internal_notes";

type AddressLookup = { label: string; line1: string };
type LookupMaps = { clients: Map<string, string>; addresses: Map<string, AddressLookup> };

async function loadLookupMaps(context: BusinessContext): Promise<LookupMaps> {
  const supabase = await createClient();
  const [clientsResult, addressesResult] = await Promise.all([
    supabase.from("clients").select("id, display_name").eq("business_id", context.businessId),
    supabase.from("client_addresses").select("id, label, line_1").eq("business_id", context.businessId),
  ]);
  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (addressesResult.error) throw new Error(addressesResult.error.message);
  return {
    clients: new Map(z.array(clientRowSchema).parse(clientsResult.data || []).map((row) => [row.id, row.display_name])),
    addresses: new Map(z.array(addressRowSchema).parse(addressesResult.data || []).map((row) => [row.id, { label: row.label, line1: row.line_1 }])),
  };
}

function groupByParent<T extends { description: string; quantity: number; unit_price: number }>(rows: T[], parentId: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(parentId(row), [...(groups.get(parentId(row)) || []), row]);
  return groups;
}

function groupRows<T>(rows: T[], parentId: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(parentId(row), [...(groups.get(parentId(row)) || []), row]);
  return groups;
}

function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Australia/Brisbane" }).format(new Date(`${value}T00:00:00`)) : "—"; }
function formatScheduledDate(value: string): { date: string; time: string; dateKey: string } { const instant = new Date(value); const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ""; const dateKey = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`; return { date: new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Australia/Brisbane" }).format(instant), time: new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(instant), dateKey }; }
function mapRecurrence(value?: z.infer<typeof recurrenceRowSchema>): string { if (!value) return "One-off"; if (value.frequency === "monthly") return "Monthly"; if (value.frequency === "weekly" && value.interval_count === 2) return "Fortnightly"; if (value.frequency === "weekly" && value.interval_count === 4) return "Four-weekly"; return "Weekly"; }
function mapLineItems(items: Array<{ label?: string | null; description: string; quantity: number; unit_label?: string; unit_price: number }>) {
  return items.map((item) => ({
    label: item.label || undefined,
    description: item.description,
    quantity: item.quantity,
    unitLabel: item.unit_label,
    rate: item.unit_price,
  }));
}
function mapQuote(row: z.infer<typeof quoteRowSchema>, lookups: LookupMaps, items: z.infer<typeof quoteItemRowSchema>[]): Quote { const address = row.service_address_id ? lookups.addresses.get(row.service_address_id)?.line1 : null; return { id: row.id, documentNumber: row.document_number || undefined, clientId: row.client_id, serviceAddressId: row.service_address_id, jobRequestId: row.job_request_id, client: lookups.clients.get(row.client_id) || "Client", address: address || "No service address", issued: formatDate(row.issue_date), expires: formatDate(row.valid_until), validDays: 14, status: mapQuoteStatus(row.status), scope: row.title, clientNotes: row.customer_message || "", internalNotes: row.internal_notes || "", discount: 0, taxRate: 0, items: mapLineItems(items) }; }
function mapJob(row: z.infer<typeof jobRowSchema>, lookups: LookupMaps, recurrence: z.infer<typeof recurrenceRowSchema> | undefined, assignments: z.infer<typeof assignmentRowSchema>[], profiles: Map<string, z.infer<typeof profileRowSchema>>, photos: JobPhoto[]): Job { const schedule = row.scheduled_start ? formatScheduledDate(row.scheduled_start) : { date: "Unscheduled", time: "", dateKey: "" }; const client = lookups.clients.get(row.client_id) || "Client"; const address = row.service_address_id ? lookups.addresses.get(row.service_address_id) : undefined; const orderedAssignments = [...assignments].sort((a, b) => Number(b.is_lead) - Number(a.is_lead)); const assignees = orderedAssignments.map((assignment) => {
    const profile = profiles.get(assignment.profile_id);
    return formatMemberDisplayName(profile?.display_name, profile?.email, profile?.role);
  }); const property = address?.label || address?.line1 || "Service property"; return { id: row.id, displayName: formatJobDisplayName({ client, address: address?.line1, property, category: row.title, date: schedule.date }), clientId: row.client_id, serviceAddressId: row.service_address_id, jobRequestId: row.job_request_id, client, property, address: address?.line1 || "No service address", category: row.title, scope: row.scope_of_work || "", date: schedule.date, time: schedule.time, dateKey: schedule.dateKey, status: mapJobStatus(row.status), notes: row.internal_instructions || "", recurrence: mapRecurrence(recurrence), assigneeIds: orderedAssignments.map((assignment) => assignment.profile_id), assignees, photos }; }
function mapInvoice(row: z.infer<typeof invoiceRowSchema>, lookups: LookupMaps, items: z.infer<typeof invoiceItemRowSchema>[], extraIds: string[] = []): Invoice { const address = row.billing_address_id ? lookups.addresses.get(row.billing_address_id)?.line1 : null; return { id: row.id, documentNumber: row.document_number || undefined, clientId: row.client_id, serviceAddressId: row.billing_address_id, extraPropertyIds: extraIds.filter((id) => id !== row.billing_address_id), jobId: row.job_id, quoteId: row.quote_id, client: lookups.clients.get(row.client_id) || "Client", address: address || "No billing address", issued: formatDate(row.issue_date), due: formatDate(row.due_date), dueDate: row.due_date, documentStatus: mapInvoiceDocumentStatus(row.document_status), paymentStatus: mapInvoicePaymentStatus(row.payment_status), scope: items.map((item) => item.description), notes: row.payment_instructions || row.internal_notes || "", discount: 0, taxRate: 0, items: mapLineItems(items) }; }

async function getQuote(context: BusinessContext, id: string): Promise<Quote> {
  const [quote] = await listQuotes(context, id);
  if (!quote) throw new Error("Quote not found.");
  return quote;
}

async function getJob(context: BusinessContext, id: string): Promise<Job> {
  const [job] = await listJobs(context, id);
  if (!job) throw new Error("Job not found.");
  return job;
}

async function getInvoice(context: BusinessContext, id: string): Promise<Invoice> {
  const [invoice] = await listInvoices(context, id);
  if (!invoice) throw new Error("Invoice not found.");
  return invoice;
}

async function assertTechnicianAssigned(
  context: BusinessContext,
  jobId: string,
): Promise<void> {
  if (context.role !== "technician") return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_assignments")
    .select("profile_id")
    .eq("business_id", context.businessId)
    .eq("job_id", jobId)
    .eq("profile_id", context.actorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("You can only update jobs assigned to you.");
  }
}

export async function listQuotes(context: BusinessContext, recordId?: string): Promise<Quote[]> { if (context.role === "technician") return []; const supabase = await createClient(); const quotesQuery = recordId ? supabase.from("quotes").select(QUOTE_SELECT).eq("business_id", context.businessId).eq("id", recordId) : supabase.from("quotes").select(QUOTE_SELECT).eq("business_id", context.businessId); const itemsQuery = recordId ? supabase.from("quote_line_items").select("quote_id, label, description, quantity, unit_label, unit_price, tax_rate").eq("business_id", context.businessId).eq("quote_id", recordId) : supabase.from("quote_line_items").select("quote_id, label, description, quantity, unit_label, unit_price, tax_rate").eq("business_id", context.businessId); const [rowsResult, itemsResult, lookups] = await Promise.all([quotesQuery.order("issue_date", { ascending: false }), itemsQuery.order("position"), loadLookupMaps(context)]); if (rowsResult.error) throw new Error(rowsResult.error.message); if (itemsResult.error) throw new Error(itemsResult.error.message); const rows = z.array(quoteRowSchema).parse(rowsResult.data || []); const items = z.array(quoteItemRowSchema).parse(itemsResult.data || []); const grouped = groupByParent(items, (item) => item.quote_id); return rows.map((row) => mapQuote(row, lookups, grouped.get(row.id) || [])); }
export async function listJobs(context: BusinessContext, recordId?: string): Promise<Job[]> { const supabase = await createClient(); const jobsQuery = recordId ? supabase.from("jobs").select(JOB_SELECT).eq("business_id", context.businessId).eq("id", recordId) : supabase.from("jobs").select(JOB_SELECT).eq("business_id", context.businessId); const recurrencesQuery = recordId ? supabase.from("job_recurrences").select("job_id, frequency, interval_count").eq("business_id", context.businessId).eq("job_id", recordId) : supabase.from("job_recurrences").select("job_id, frequency, interval_count").eq("business_id", context.businessId); const assignmentsQuery = recordId ? supabase.from("job_assignments").select("job_id, profile_id, is_lead").eq("business_id", context.businessId).eq("job_id", recordId) : supabase.from("job_assignments").select("job_id, profile_id, is_lead").eq("business_id", context.businessId); const attachmentsQuery = recordId ? supabase.from("job_attachments").select("id, job_id, storage_bucket, storage_path, original_filename, caption, created_at").eq("business_id", context.businessId).eq("job_id", recordId) : supabase.from("job_attachments").select("id, job_id, storage_bucket, storage_path, original_filename, caption, created_at").eq("business_id", context.businessId); const [rowsResult, recurrencesResult, assignmentsResult, profilesResult, attachmentsResult, lookups] = await Promise.all([jobsQuery.order("scheduled_start", { ascending: true, nullsFirst: false }), recurrencesQuery, assignmentsQuery, supabase.from("profiles").select("id, display_name, email, role").eq("business_id", context.businessId).eq("is_active", true), attachmentsQuery.order("created_at", { ascending: false }), loadLookupMaps(context)]); for (const result of [rowsResult, recurrencesResult, assignmentsResult, profilesResult, attachmentsResult]) if (result.error) throw new Error(result.error.message); const rows = z.array(jobRowSchema).parse(rowsResult.data || []); const recurrences = z.array(recurrenceRowSchema).parse(recurrencesResult.data || []); const assignments = z.array(assignmentRowSchema).parse(assignmentsResult.data || []); const profiles = z.array(profileRowSchema).parse(profilesResult.data || []); const attachments = z.array(attachmentRowSchema).parse(attachmentsResult.data || []); const recurrenceByJob = new Map(recurrences.map((row) => [row.job_id, row])); const assignmentsByJob = groupRows(assignments, (row) => row.job_id); const profileById = new Map(profiles.map((row) => [row.id, row])); const signedPhotos = await Promise.all(attachments.map(async (attachment): Promise<[string, JobPhoto]> => { const { data } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60 * 60); return [attachment.job_id, { id: attachment.id, name: attachment.original_filename, url: data?.signedUrl || "", caption: attachment.caption || "", created: formatDate(attachment.created_at.slice(0, 10)) }]; })); const photosByJob = groupRows(signedPhotos, ([jobId]) => jobId); return rows.map((row) => mapJob(row, lookups, recurrenceByJob.get(row.id), assignmentsByJob.get(row.id) || [], profileById, (photosByJob.get(row.id) || []).map(([, photo]) => photo))); }
export async function listInvoices(context: BusinessContext, recordId?: string): Promise<Invoice[]> {
  if (context.role === "technician") return [];
  const supabase = await createClient();
  const invoicesQuery = recordId
    ? supabase.from("invoices").select(INVOICE_SELECT).eq("business_id", context.businessId).eq("id", recordId)
    : supabase.from("invoices").select(INVOICE_SELECT).eq("business_id", context.businessId);
  const itemsQuery = recordId
    ? supabase.from("invoice_line_items").select("invoice_id, label, description, quantity, unit_label, unit_price, tax_rate").eq("business_id", context.businessId).eq("invoice_id", recordId)
    : supabase.from("invoice_line_items").select("invoice_id, label, description, quantity, unit_label, unit_price, tax_rate").eq("business_id", context.businessId);
  const extrasQuery = recordId
    ? supabase.from("invoice_service_addresses").select("invoice_id, client_address_id").eq("business_id", context.businessId).eq("invoice_id", recordId)
    : supabase.from("invoice_service_addresses").select("invoice_id, client_address_id").eq("business_id", context.businessId);
  const [rowsResult, itemsResult, extrasResult, lookups] = await Promise.all([
    invoicesQuery.order("issue_date", { ascending: false }),
    itemsQuery.order("position"),
    extrasQuery,
    loadLookupMaps(context),
  ]);
  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  const extras = extrasResult.error
    ? []
    : z.array(z.object({ invoice_id: z.uuid(), client_address_id: z.uuid() })).parse(extrasResult.data || []);
  const rows = z.array(invoiceRowSchema).parse(rowsResult.data || []);
  const items = z.array(invoiceItemRowSchema).parse(itemsResult.data || []);
  const grouped = groupByParent(items, (item) => item.invoice_id);
  const extrasByInvoice = groupRows(extras, (row) => row.invoice_id);
  return rows.map((row) =>
    mapInvoice(
      row,
      lookups,
      grouped.get(row.id) || [],
      (extrasByInvoice.get(row.id) || []).map((item) => item.client_address_id),
    ),
  );
}

async function getRequestTarget(context: BusinessContext, requestId: string) { const supabase = await createClient(); const { data, error } = await supabase.from("job_requests").select("id, client_id, service_address_id, title, description").eq("business_id", context.businessId).eq("id", requestId).single(); if (error) throw new Error(`Unable to load job request: ${error.message}`); const row = z.object({ id: z.uuid(), client_id: z.uuid().nullable(), service_address_id: z.uuid().nullable(), title: z.string(), description: z.string().nullable() }).parse(data); if (!row.client_id || !row.service_address_id) throw new Error("The job request needs a client and service property first."); return row; }

export async function createQuote(context: BusinessContext, input: QuoteDraftInput): Promise<Quote> { const target = await getRequestTarget(context, input.jobRequestId); const supabase = await createClient(); const issueDate = new Date().toISOString().slice(0, 10); const validUntil = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10); const { data, error } = await supabase.from("quotes").insert({ business_id: context.businessId, client_id: target.client_id, service_address_id: target.service_address_id, job_request_id: target.id, status: "draft", title: input.scope, issue_date: issueDate, valid_until: validUntil, customer_message: input.clientNotes || null, internal_notes: input.internalNotes || null, created_by: context.actorId }).select("id").single(); if (error) throw new Error(error.message); const quoteId = z.object({ id: z.uuid() }).parse(data).id; const { error: itemsError } = await supabase.from("quote_line_items").insert(input.items.map((item, position) => ({ business_id: context.businessId, quote_id: quoteId, position, label: item.label || null, description: item.description, quantity: item.quantity, unit_label: item.unitLabel || "item", unit_price: item.rate, tax_rate: 0 }))); if (itemsError) throw new Error(itemsError.message); return getQuote(context, quoteId); }
export async function updateQuote(context: BusinessContext, input: QuoteDraftInput): Promise<Quote> {
  if (!input.id) throw new Error("Quote identifier is required.");
  const current = await getQuote(context, input.id);
  assertQuoteCanBeEdited(current);
  const target = await getRequestTarget(context, input.jobRequestId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      client_id: target.client_id,
      service_address_id: target.service_address_id,
      job_request_id: target.id,
      title: input.scope,
      customer_message: input.clientNotes || null,
      internal_notes: input.internalNotes || null,
    })
    .eq("business_id", context.businessId)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  const { error: deleteError } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("business_id", context.businessId)
    .eq("quote_id", input.id);
  if (deleteError) throw new Error(deleteError.message);
  const { error: itemsError } = await supabase.from("quote_line_items").insert(
    input.items.map((item, position) => ({
      business_id: context.businessId,
      quote_id: input.id,
      position,
      label: item.label || null,
      description: item.description,
      quantity: item.quantity,
      unit_label: item.unitLabel || "item",
      unit_price: item.rate,
      tax_rate: 0,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);
  return getQuote(context, input.id);
}
export async function updateQuoteStatus(context: BusinessContext, id: string, status: Quote["status"]): Promise<Quote> { const dbStatus = status === "Accepted" ? "approved" : status === "Declined" ? "declined" : status.toLowerCase(); const supabase = await createClient(); const { error } = await supabase.from("quotes").update({ status: dbStatus }).eq("business_id", context.businessId).eq("id", id); if (error) throw new Error(error.message); return getQuote(context, id); }
export async function deleteQuote(context: BusinessContext, id: string): Promise<string> { const supabase = await createClient(); const { data, error } = await supabase.from("quotes").delete().eq("business_id", context.businessId).eq("id", id).select("id").single(); if (error) throw new Error(error.message); return z.object({ id: z.uuid() }).parse(data).id; }

export async function scheduleJob(context: BusinessContext, input: ScheduleJobInput): Promise<Job> {
  const target = await getRequestTarget(context, input.jobRequestId);
  const start = new Date(input.scheduledStart);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      business_id: context.businessId,
      client_id: target.client_id,
      service_address_id: target.service_address_id,
      job_request_id: target.id,
      status: "scheduled",
      title: target.title,
      scope_of_work: target.description,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      created_by: context.actorId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const jobId = z.object({ id: z.uuid() }).parse(data).id;
  if (input.profileIds?.length) {
    return updateJobAssignments(context, { jobId, profileIds: input.profileIds });
  }
  return getJob(context, jobId);
}

async function findChildOccurrence(context: BusinessContext, parentJobId: string): Promise<Job | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("business_id", context.businessId)
    .eq("recurrence_parent_job_id", parentJobId)
    .order("scheduled_start", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return undefined;
  const id = z.object({ id: z.uuid() }).parse(data).id;
  return getJob(context, id);
}

async function spawnNextRecurringJob(
  context: BusinessContext,
  jobId: string,
): Promise<Job | undefined> {
  const existing = await findChildOccurrence(context, jobId);
  if (existing) return existing;

  const supabase = await createClient();
  const { data: rpcId, error: rpcError } = await supabase.rpc("spawn_next_recurring_job", {
    p_job_id: jobId,
  });
  if (rpcError) {
    const missing = /could not find the function|schema cache|does not exist/i.test(
      rpcError.message,
    );
    if (!missing) throw new Error(rpcError.message);
  } else {
    const spawnedId = z.uuid().nullable().optional().parse(rpcId);
    if (spawnedId) return getJob(context, spawnedId);
    return findChildOccurrence(context, jobId);
  }

  if (context.role === "technician") return undefined;

  const { data: row, error: loadError } = await supabase
    .from("jobs")
    .select(
      "id, client_id, client_contact_id, service_address_id, job_request_id, title, scope_of_work, internal_instructions, scheduled_start, scheduled_end, schedule_timezone, created_by, status",
    )
    .eq("business_id", context.businessId)
    .eq("id", jobId)
    .single();
  if (loadError) throw new Error(loadError.message);
  const job = z
    .object({
      id: z.uuid(),
      client_id: z.uuid(),
      client_contact_id: z.uuid().nullable(),
      service_address_id: z.uuid().nullable(),
      job_request_id: z.uuid().nullable(),
      title: z.string(),
      scope_of_work: z.string().nullable(),
      internal_instructions: z.string().nullable(),
      scheduled_start: z.string().nullable(),
      scheduled_end: z.string().nullable(),
      schedule_timezone: z.string().nullable(),
      created_by: z.uuid().nullable(),
      status: z.string(),
    })
    .parse(row);
  if (job.status !== "completed" || !job.scheduled_start) return undefined;

  const { data: recRow, error: recError } = await supabase
    .from("job_recurrences")
    .select("frequency, interval_count, by_weekday, by_month_day, custom_rrule, ends_on, max_occurrences")
    .eq("business_id", context.businessId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (recError) throw new Error(recError.message);
  if (!recRow) return undefined;
  const rec = z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
      interval_count: z.number(),
      by_weekday: z.array(z.number()).nullable().optional(),
      by_month_day: z.number().nullable().optional(),
      custom_rrule: z.string().nullable().optional(),
      ends_on: z.string().nullable().optional(),
      max_occurrences: z.number().nullable().optional(),
    })
    .parse(recRow);

  const label =
    rec.frequency === "monthly"
      ? "Monthly"
      : rec.interval_count === 2
        ? "Fortnightly"
        : rec.interval_count === 4
          ? "Four-weekly"
          : "Weekly";
  const nextStart = nextScheduledIso(job.scheduled_start, label);
  if (!nextStart) return undefined;
  const durationMs = job.scheduled_end
    ? Math.max(new Date(job.scheduled_end).getTime() - new Date(job.scheduled_start).getTime(), 60 * 60 * 1000)
    : 60 * 60 * 1000;
  const nextEnd = new Date(new Date(nextStart).getTime() + durationMs).toISOString();
  const nextDate = nextStart.slice(0, 10);

  const { data: inserted, error: insertError } = await supabase
    .from("jobs")
    .insert({
      business_id: context.businessId,
      client_id: job.client_id,
      client_contact_id: job.client_contact_id,
      service_address_id: job.service_address_id,
      job_request_id: job.job_request_id,
      recurrence_parent_job_id: job.id,
      recurrence_instance_date: nextDate,
      status: "scheduled",
      title: job.title,
      scope_of_work: job.scope_of_work,
      internal_instructions: job.internal_instructions,
      scheduled_start: nextStart,
      scheduled_end: nextEnd,
      schedule_timezone: job.schedule_timezone || "Australia/Brisbane",
      created_by: job.created_by || context.actorId,
    })
    .select("id")
    .single();
  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message)) {
      return findChildOccurrence(context, jobId);
    }
    throw new Error(insertError.message);
  }
  const nextId = z.object({ id: z.uuid() }).parse(inserted).id;
  const { data: assignments, error: assignmentError } = await supabase
    .from("job_assignments")
    .select("profile_id, is_lead, assigned_by")
    .eq("business_id", context.businessId)
    .eq("job_id", jobId);
  if (assignmentError) throw new Error(assignmentError.message);
  const copied = z
    .array(
      z.object({
        profile_id: z.uuid(),
        is_lead: z.boolean(),
        assigned_by: z.uuid().nullable().optional(),
      }),
    )
    .parse(assignments || []);
  if (copied.length) {
    const { error: copyError } = await supabase.from("job_assignments").insert(
      copied.map((assignment) => ({
        business_id: context.businessId,
        job_id: nextId,
        profile_id: assignment.profile_id,
        is_lead: assignment.is_lead,
        assigned_by: assignment.assigned_by || context.actorId,
      })),
    );
    if (copyError) throw new Error(copyError.message);
  }
  const mapped = recurrenceToDb(label);
  const { error: nextRecError } = await supabase.from("job_recurrences").upsert(
    {
      job_id: nextId,
      business_id: context.businessId,
      frequency: mapped.frequency,
      interval_count: mapped.intervalCount,
      starts_on: nextDate,
      ends_on: rec.ends_on || null,
      max_occurrences: rec.max_occurrences || null,
    },
    { onConflict: "job_id" },
  );
  if (nextRecError) throw new Error(nextRecError.message);
  return getJob(context, nextId);
}

export async function updateJob(
  context: BusinessContext,
  input: JobUpdateInput,
): Promise<{ job: Job; nextJob?: Job }> {
  await assertTechnicianAssigned(context, input.id);
  const supabase = await createClient();
  const dbStatus =
    input.status === "in-progress"
      ? "in_progress"
      : input.status === "on-hold"
        ? "paused"
        : input.status;
  const { data: row, error } = await supabase
    .from("jobs")
    .update({ status: dbStatus, internal_instructions: input.notes || null })
    .eq("business_id", context.businessId)
    .eq("id", input.id)
    .select("scheduled_start")
    .single();
  if (error) throw new Error(error.message);
  if (context.role !== "technician") {
    if (input.recurrence === "One-off") {
      await supabase
        .from("job_recurrences")
        .delete()
        .eq("business_id", context.businessId)
        .eq("job_id", input.id);
    } else {
      const mapped = recurrenceToDb(input.recurrence);
      const startDate =
        z.object({ scheduled_start: z.string().nullable() }).parse(row).scheduled_start?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      const { error: recurrenceError } = await supabase.from("job_recurrences").upsert(
        {
          job_id: input.id,
          business_id: context.businessId,
          frequency: mapped.frequency,
          interval_count: mapped.intervalCount,
          starts_on: startDate,
        },
        { onConflict: "job_id" },
      );
      if (recurrenceError) throw new Error(recurrenceError.message);
    }
  }
  const job = await getJob(context, input.id);
  if (job.status !== "completed" || !isRepeatingRecurrence(job.recurrence || input.recurrence)) {
    return { job };
  }
  const nextJob = await spawnNextRecurringJob(context, input.id);
  return { job, nextJob };
}

export async function deleteJob(context: BusinessContext, id: string): Promise<string> {
  const job = await getJob(context, id);
  assertJobCanBeDeleted(job);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("business_id", context.businessId)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return z.object({ id: z.uuid() }).parse(data).id;
}

export async function listTeamMembers(context: BusinessContext): Promise<TeamMember[]> { const supabase = await createClient(); const { data, error } = await supabase.from("profiles").select("id, display_name, email, role").eq("business_id", context.businessId).eq("is_active", true).order("display_name"); if (error) throw new Error(error.message); return z.array(profileRowSchema).parse(data || []).map((row) => ({ id: row.id, name: formatMemberDisplayName(row.display_name, row.email, row.role), email: row.email || "", role: row.role === "co_owner" ? "Co-owner" : row.role === "technician" ? "Worker" : "Owner", isActive: true })); }

export async function updateJobAssignments(context: BusinessContext, input: JobAssignmentsInput): Promise<Job> { const supabase = await createClient(); const uniqueIds = [...new Set(input.profileIds)]; if (uniqueIds.length) { const { data: members, error: memberError } = await supabase.from("profiles").select("id").eq("business_id", context.businessId).eq("is_active", true).in("id", uniqueIds); if (memberError) throw new Error(memberError.message); if ((members || []).length !== uniqueIds.length) throw new Error("One or more selected team members are unavailable."); } const { error: clearLeadError } = await supabase.from("job_assignments").update({ is_lead: false }).eq("business_id", context.businessId).eq("job_id", input.jobId); if (clearLeadError) throw new Error(clearLeadError.message); if (uniqueIds.length) { const { error: upsertError } = await supabase.from("job_assignments").upsert(uniqueIds.map((profileId) => ({ business_id: context.businessId, job_id: input.jobId, profile_id: profileId, is_lead: false, assigned_by: context.actorId })), { onConflict: "job_id,profile_id" }); if (upsertError) throw new Error(upsertError.message); const { error: leadError } = await supabase.from("job_assignments").update({ is_lead: true }).eq("business_id", context.businessId).eq("job_id", input.jobId).eq("profile_id", uniqueIds[0]); if (leadError) throw new Error(leadError.message); } let deleteQuery = supabase.from("job_assignments").delete().eq("business_id", context.businessId).eq("job_id", input.jobId); if (uniqueIds.length) deleteQuery = deleteQuery.not("profile_id", "in", `(${uniqueIds.join(",")})`); const { error: deleteError } = await deleteQuery; if (deleteError) throw new Error(deleteError.message); return getJob(context, input.jobId); }

export async function uploadJobPhoto(context: BusinessContext, jobId: string, file: File, caption: string): Promise<JobPhoto> { await assertTechnicianAssigned(context, jobId); const supabase = await createClient(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "photo"; const storagePath = `${context.businessId}/${jobId}/${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await supabase.storage.from("job-attachments").upload(storagePath, file, { contentType: file.type, upsert: false }); if (uploadError) throw new Error(uploadError.message); const { data, error } = await supabase.from("job_attachments").insert({ business_id: context.businessId, job_id: jobId, storage_bucket: "job-attachments", storage_path: storagePath, original_filename: file.name, mime_type: file.type, byte_size: file.size, caption: caption || null, uploaded_by: context.actorId }).select("id, original_filename, caption, created_at").single(); if (error) { await supabase.storage.from("job-attachments").remove([storagePath]); throw new Error(error.message); } const row = z.object({ id: z.uuid(), original_filename: z.string(), caption: z.string().nullable(), created_at: z.string() }).parse(data); const { data: signed } = await supabase.storage.from("job-attachments").createSignedUrl(storagePath, 60 * 60); return { id: row.id, name: row.original_filename, url: signed?.signedUrl || "", caption: row.caption || "", created: formatDate(row.created_at.slice(0, 10)) }; }

export async function deleteJobPhoto(context: BusinessContext, jobId: string, photoId: string): Promise<string> { await assertTechnicianAssigned(context, jobId); const supabase = await createClient(); const { data, error: loadError } = await supabase.from("job_attachments").select("id, storage_bucket, storage_path").eq("business_id", context.businessId).eq("job_id", jobId).eq("id", photoId).single(); if (loadError) throw new Error(loadError.message); const row = z.object({ id: z.uuid(), storage_bucket: z.string(), storage_path: z.string() }).parse(data); const { error: deleteError } = await supabase.from("job_attachments").delete().eq("business_id", context.businessId).eq("job_id", jobId).eq("id", photoId); if (deleteError) throw new Error(deleteError.message); const { error: storageError } = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]); if (storageError) throw new Error(storageError.message); return row.id; }

export async function createInvoice(context: BusinessContext, input: InvoiceDraftInput): Promise<Invoice> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice_with_details", invoiceCreateRpcArgs(input));
  if (error) throw new Error(error.message);
  const invoiceId = z.uuid().parse(data);
  if (input.quoteId) {
    const { error: linkError } = await supabase
      .from("invoices")
      .update({ quote_id: input.quoteId })
      .eq("business_id", context.businessId)
      .eq("id", invoiceId);
    if (linkError) throw new Error(linkError.message);
  }
  return getInvoice(context, invoiceId);
}

export async function updateInvoice(context: BusinessContext, input: InvoiceDraftInput): Promise<Invoice> {
  if (!input.id) throw new Error("Invoice identifier is required.");
  const current = await getInvoice(context, input.id);
  assertInvoiceCanBeEdited(current);
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("issue_date, document_status")
    .eq("business_id", context.businessId)
    .eq("id", input.id)
    .single();
  if (existingError) throw new Error(existingError.message);
  const row = z
    .object({
      issue_date: z.string(),
      document_status: z.string(),
    })
    .parse(existing);
  assertInvoiceCanBeEdited({
    documentStatus: row.document_status === "draft" ? "Draft" : "Issued",
  });

  const extras = [...new Set((input.extraPropertyIds ?? []).filter((id) => id !== input.propertyId))];
  const addressIds = [input.propertyId, ...extras];
  const { data: addresses, error: addressError } = await supabase
    .from("client_addresses")
    .select("id")
    .eq("business_id", context.businessId)
    .eq("client_id", input.clientId)
    .in("id", addressIds);
  if (addressError) throw new Error(addressError.message);
  if ((addresses || []).length !== addressIds.length) {
    throw new Error("One or more selected invoice properties are no longer available.");
  }

  const issueDate = row.issue_date.slice(0, 10);
  const [year, month, day] = issueDate.split("-").map(Number);
  const due = new Date(Date.UTC(year, month - 1, day + Math.max(input.dueDays, 0)));
  const dueDate = due.toISOString().slice(0, 10);

  const { error } = await supabase
    .from("invoices")
    .update({
      client_id: input.clientId,
      billing_address_id: input.propertyId,
      job_id: input.jobId ?? null,
      quote_id: input.quoteId ?? current.quoteId ?? null,
      due_date: dueDate,
      payment_instructions: input.notes || null,
    })
    .eq("business_id", context.businessId)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  const { error: deleteItemsError } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("business_id", context.businessId)
    .eq("invoice_id", input.id);
  if (deleteItemsError) throw new Error(deleteItemsError.message);
  const { error: itemsError } = await supabase.from("invoice_line_items").insert(
    input.items.map((item, position) => ({
      business_id: context.businessId,
      invoice_id: input.id,
      position,
      label: item.label || null,
      description: item.description,
      quantity: item.quantity,
      unit_label: item.unitLabel || "item",
      unit_price: item.rate,
      tax_rate: 0,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  const { error: deleteExtrasError } = await supabase
    .from("invoice_service_addresses")
    .delete()
    .eq("business_id", context.businessId)
    .eq("invoice_id", input.id);
  if (
    deleteExtrasError &&
    !/invoice_service_addresses|schema cache|does not exist/i.test(deleteExtrasError.message)
  ) {
    throw new Error(deleteExtrasError.message);
  }
  if (!deleteExtrasError) {
    const { error: extrasError } = await supabase.from("invoice_service_addresses").insert(
      addressIds.map((addressId, position) => ({
        business_id: context.businessId,
        invoice_id: input.id,
        client_address_id: addressId,
        position,
      })),
    );
    if (extrasError) throw new Error(extrasError.message);
  }

  return getInvoice(context, input.id);
}

export async function updateInvoicePayment(context: BusinessContext, id: string, status: Invoice["paymentStatus"]): Promise<Invoice> {
  const current = await getInvoice(context, id);
  const next = applyInvoicePayment(current, status);
  const supabase = await createClient();
  if (next.documentStatus !== current.documentStatus) {
    const { error: documentError } = await supabase
      .from("invoices")
      .update({ document_status: toDbDocumentStatus(next.documentStatus) })
      .eq("business_id", context.businessId)
      .eq("id", id);
    if (documentError) throw new Error(documentError.message);
  }
  await syncInvoicePaymentRecords(context, id, next);
  return getInvoice(context, id);
}

const paymentRowSchema = z.object({
  id: z.uuid(),
  amount: z.coerce.number(),
  status: z.enum(["recorded", "voided", "refunded"]),
});

async function syncInvoicePaymentRecords(
  context: BusinessContext,
  invoiceId: string,
  invoice: Invoice,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, status")
    .eq("business_id", context.businessId)
    .eq("invoice_id", invoiceId);
  if (error) throw new Error(error.message);

  const rows = z.array(paymentRowSchema).parse(data || []);
  const recordedSum = rows
    .filter((row) => row.status === "recorded")
    .reduce((sum, row) => sum + row.amount, 0);
  const plan = planInvoicePaymentRecords(invoice, invoice.paymentStatus, recordedSum);

  if (plan.voidRecorded) {
    const { error: voidError } = await supabase
      .from("payments")
      .update({ status: "voided" })
      .eq("business_id", context.businessId)
      .eq("invoice_id", invoiceId)
      .eq("status", "recorded");
    if (voidError) throw new Error(voidError.message);
  }

  if (plan.insert) {
    const { error: insertError } = await supabase.from("payments").insert({
      business_id: context.businessId,
      invoice_id: invoiceId,
      amount: plan.insert.amount,
      method: plan.insert.method,
      status: plan.insert.status,
      notes: plan.insert.notes,
      recorded_by: context.actorId,
    });
    if (insertError) throw new Error(insertError.message);
  }
}

export async function finalizeInvoice(context: BusinessContext, id: string): Promise<Invoice> {
  const next = finalizeInvoiceRecord(await getInvoice(context, id));
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ document_status: toDbDocumentStatus(next.documentStatus) })
    .eq("business_id", context.businessId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return getInvoice(context, id);
}

export async function markInvoiceAsSent(context: BusinessContext, id: string): Promise<Invoice> {
  const next = markInvoiceSent(await getInvoice(context, id));
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ document_status: toDbDocumentStatus(next.documentStatus) })
    .eq("business_id", context.businessId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return getInvoice(context, id);
}

export async function voidIssuedInvoice(context: BusinessContext, id: string): Promise<Invoice> {
  const next = voidInvoice(await getInvoice(context, id));
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ document_status: toDbDocumentStatus(next.documentStatus) })
    .eq("business_id", context.businessId)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return getInvoice(context, id);
}

export async function deleteInvoice(context: BusinessContext, id: string): Promise<string> {
  const invoice = await getInvoice(context, id);
  assertInvoiceCanBeDeleted(invoice);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("business_id", context.businessId)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return z.object({ id: z.uuid() }).parse(data).id;
}
