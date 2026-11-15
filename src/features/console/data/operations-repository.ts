import "server-only";

import { z } from "zod";

import { formatMemberDisplayName } from "@/lib/brand";
import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { Invoice, InvoicePayment, Job, JobPhoto, Quote, TeamMember } from "../domain";
import type { InvoicePaymentInput } from "./invoice-contract";
import type { InvoiceDraftInput, JobAssignmentsInput, JobNoteInput, JobUpdateInput, QuoteDraftInput, ScheduleJobInput } from "./operations-contract";
import { recurrenceToDb } from "./job-recurrence";
import {
  mapInvoiceDocumentStatus,
  mapInvoicePaymentStatus,
  mapJobStatus,
  mapQuoteStatus,
} from "./operations-map";
import { assertJobCanBeDeleted } from "./operations-rules";
import { formatJobDisplayName } from "./work-identity";
import { brisbaneToday } from "./invoice-lifecycle";
import {
  lineItemRowSchema,
  parseAddressLookups,
  type AddressLookup,
} from "./operations-row-schemas";

const itemSchema = lineItemRowSchema;
const clientRowSchema = z.object({ id: z.uuid(), display_name: z.string() });
const profileRowSchema = z.object({ id: z.uuid(), display_name: z.string().nullable(), email: z.string().nullable(), role: z.enum(["owner", "co_owner", "technician"]) });
const assignmentRowSchema = z.object({ job_id: z.uuid(), profile_id: z.uuid(), is_lead: z.boolean() });
const attachmentRowSchema = z.object({ id: z.uuid(), job_id: z.uuid(), storage_bucket: z.string(), storage_path: z.string(), original_filename: z.string(), caption: z.string().nullable(), created_at: z.string() });
const quoteItemRowSchema = itemSchema.extend({ quote_id: z.uuid() });
const invoiceItemRowSchema = itemSchema.extend({ invoice_id: z.uuid() });
const recurrenceRowSchema = z.object({ job_id: z.uuid(), frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]), interval_count: z.number() });
const quoteSnapshotSchema = z.object({
  client: z.string(),
  address: z.string().nullable(),
  issuer: z.object({ name: z.string(), abn: z.string(), email: z.string(), phone: z.string(), website: z.string() }),
});
const quoteRowSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  service_address_id: z.uuid().nullable(),
  job_request_id: z.uuid().nullable(),
  document_number: z.string().nullable(),
  status: z.enum(["draft", "sent", "approved", "declined", "expired", "void"]),
  title: z.string(),
  issue_date: z.string(),
  valid_until: z.string().nullable(),
  customer_message: z.string().nullable(),
  internal_notes: z.string().nullable(),
  customer_reference: z.string().nullable(),
  terms_text: z.string().nullable(),
  revision_of_quote_id: z.uuid().nullable(),
  issue_snapshot: quoteSnapshotSchema.nullable(),
  updated_at: z.string(),
});
const jobRowSchema = z.object({ id: z.uuid(), quote_id: z.uuid().nullable(), client_id: z.uuid(), service_address_id: z.uuid().nullable(), job_request_id: z.uuid().nullable(), status: z.enum(["unscheduled", "scheduled", "in_progress", "paused", "completed", "cancelled"]), title: z.string(), scope_of_work: z.string().nullable(), internal_instructions: z.string().nullable(), scheduled_start: z.string().nullable(), updated_at: z.string() });
const invoiceSnapshotSchema = z.object({
  clientName: z.string(),
  billingName: z.string().optional(),
  billingAddress: z.string().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().optional(),
  serviceAddresses: z.array(z.string()),
  issuer: z.object({ name: z.string(), abn: z.string(), email: z.string(), phone: z.string(), website: z.string(),
    paymentTo: z.string(), bsb: z.string(), accountNumber: z.string() }),
});
const invoiceRowSchema = z.object({
  id: z.uuid(), client_id: z.uuid(), billing_address_id: z.uuid().nullable(),
  job_id: z.uuid().nullable(), request_id: z.uuid().nullable(), quote_id: z.uuid().nullable(),
  document_number: z.string().nullable(), document_status: z.string(), payment_status: z.string(),
  issue_date: z.string(), due_date: z.string().nullable(), service_date: z.string().nullable(),
  payment_instructions: z.string().nullable(), internal_notes: z.string().nullable(),
  customer_message: z.string().nullable(), scope_of_work: z.string().nullable(), document_terms: z.string().nullable(),
  separates_customer_fields: z.boolean(), duplicate_source: z.boolean(), draft_version: z.number(),
  external_reference: z.string().nullable(), billing_name: z.string().nullable(),
  billing_address_text: z.string().nullable(), recipient_name: z.string().nullable(), recipient_email: z.string().nullable(),
  issue_snapshot: invoiceSnapshotSchema.nullable(), replaces_invoice_id: z.uuid().nullable(),
  correction_reason: z.string().nullable(),
  subtotal: z.coerce.number(), tax_total: z.coerce.number(), total: z.coerce.number(),
  amount_paid: z.coerce.number(), balance_due: z.coerce.number(),
});
const invoicePaymentRowSchema = z.object({
  invoice_id: z.uuid(), id: z.uuid(), idempotency_key: z.uuid().nullable(),
  entry_kind: z.enum(["receipt", "reversal", "refund"]).nullable(), amount: z.coerce.number(),
  method: z.enum(["cash", "bank_transfer", "card_external", "cheque", "other"]),
  status: z.enum(["recorded", "voided", "refunded"]), paid_at: z.string(), paid_on: z.string().nullable(),
  reference: z.string().nullable(), receipt_id: z.uuid().nullable(), notes: z.string().nullable(),
});

const QUOTE_SELECT = "id, client_id, service_address_id, job_request_id, document_number, status, title, issue_date, valid_until, customer_message, internal_notes, customer_reference, terms_text, revision_of_quote_id, issue_snapshot, updated_at";
const JOB_SELECT = "id, quote_id, client_id, service_address_id, job_request_id, status, title, scope_of_work, internal_instructions, scheduled_start, updated_at";
const INVOICE_SELECT = "id, client_id, billing_address_id, job_id, request_id, quote_id, document_number, document_status, payment_status, issue_date, due_date, service_date, payment_instructions, internal_notes, customer_message, scope_of_work, document_terms, separates_customer_fields, duplicate_source, draft_version, external_reference, billing_name, billing_address_text, recipient_name, recipient_email, issue_snapshot, replaces_invoice_id, correction_reason, subtotal, tax_total, total, amount_paid, balance_due";
const INVOICE_PAYMENT_SELECT = "invoice_id, id, idempotency_key, entry_kind, amount, method, status, paid_at, paid_on, reference, receipt_id, notes";

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
    addresses: parseAddressLookups(addressesResult.data),
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
function mapLineItems(items: Array<{ label?: string | null; description: string; quantity: number; unit_label?: string | null; unit_price: number }>) {
  return items.map((item) => ({
    label: item.label || undefined,
    description: item.description,
    quantity: item.quantity,
    unitLabel: item.unit_label || undefined,
    rate: item.unit_price,
  }));
}
function mapQuote(row: z.infer<typeof quoteRowSchema>, lookups: LookupMaps, items: z.infer<typeof quoteItemRowSchema>[]): Quote {
  const address = row.issue_snapshot
    ? row.issue_snapshot.address
    : row.service_address_id ? lookups.addresses.get(row.service_address_id)?.line1 : null;
  return {
    id: row.id,
    updatedAt: row.updated_at,
    documentNumber: row.document_number || undefined,
    clientId: row.client_id,
    serviceAddressId: row.service_address_id,
    jobRequestId: row.job_request_id,
    client: row.issue_snapshot?.client ?? lookups.clients.get(row.client_id) ?? "Client",
    address: address || "No service address",
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    issued: formatDate(row.issue_date),
    expires: row.valid_until ? formatDate(row.valid_until) : "No expiry",
    validDays: row.valid_until ? Math.round((Date.parse(row.valid_until) - Date.parse(row.issue_date)) / 86_400_000) : 0,
    reference: row.customer_reference ?? undefined,
    terms: row.terms_text ?? undefined,
    revisionOfQuoteId: row.revision_of_quote_id,
    issuerSnapshot: row.issue_snapshot?.issuer,
    status: mapQuoteStatus(row.status),
    scope: row.title,
    clientNotes: row.customer_message || "",
    internalNotes: row.internal_notes || "",
    discount: 0,
    taxRate: 0,
    items: mapLineItems(items),
  };
}
function mapJob(row: z.infer<typeof jobRowSchema>, lookups: LookupMaps, recurrence: z.infer<typeof recurrenceRowSchema> | undefined, assignments: z.infer<typeof assignmentRowSchema>[], profiles: Map<string, z.infer<typeof profileRowSchema>>, photos: JobPhoto[]): Job { const schedule = row.scheduled_start ? formatScheduledDate(row.scheduled_start) : { date: "Unscheduled", time: "", dateKey: "" }; const client = lookups.clients.get(row.client_id) || "Client"; const address = row.service_address_id ? lookups.addresses.get(row.service_address_id) : undefined; const orderedAssignments = [...assignments].sort((a, b) => Number(b.is_lead) - Number(a.is_lead)); const assignees = orderedAssignments.map((assignment) => {
    const profile = profiles.get(assignment.profile_id);
    return formatMemberDisplayName(profile?.display_name, profile?.email, profile?.role);
  }); const property = address?.label || address?.line1 || "Service property"; return { id: row.id, updatedAt: row.updated_at, quoteId: row.quote_id, displayName: formatJobDisplayName({ client, address: address?.line1, property, category: row.title, date: schedule.date }), clientId: row.client_id, serviceAddressId: row.service_address_id, jobRequestId: row.job_request_id, client, property, address: address?.line1 || "No service address", category: row.title, scope: row.scope_of_work || "", date: schedule.date, time: schedule.time, dateKey: schedule.dateKey, status: mapJobStatus(row.status), notes: row.internal_instructions || "", recurrence: mapRecurrence(recurrence), assigneeIds: orderedAssignments.map((assignment) => assignment.profile_id), assignees, photos }; }
function mapInvoice(
  row: z.infer<typeof invoiceRowSchema>,
  lookups: LookupMaps,
  items: z.infer<typeof invoiceItemRowSchema>[],
  extraIds: string[],
  entries: z.infer<typeof invoicePaymentRowSchema>[],
): Invoice {
  const siteIds = [...new Set([...(row.billing_address_id ? [row.billing_address_id] : []), ...extraIds])];
  const serviceAddresses = row.issue_snapshot?.serviceAddresses ??
    siteIds.flatMap((id) => lookups.addresses.get(id)?.line1 ?? []);
  const payments: InvoicePayment[] = entries.map((entry) => ({
    id: entry.id,
    idempotencyKey: entry.idempotency_key ?? undefined,
    kind: entry.entry_kind ?? (entry.status === "refunded" ? "refund" : "receipt"),
    status: entry.status,
    amount: entry.amount,
    method: entry.method,
    paidOn: entry.paid_on ?? brisbaneToday(new Date(entry.paid_at)),
    reference: entry.reference ?? undefined,
    receiptId: entry.receipt_id ?? undefined,
    reason: entry.notes ?? undefined,
  }));
  return {
    id: row.id,
    documentNumber: row.document_number ?? undefined,
    clientId: row.client_id,
    serviceAddressId: row.billing_address_id,
    extraPropertyIds: extraIds.filter((id) => id !== row.billing_address_id),
    jobId: row.job_id,
    requestId: row.request_id,
    quoteId: row.quote_id,
    client: row.issue_snapshot?.clientName ?? lookups.clients.get(row.client_id) ?? "Client",
    address: serviceAddresses[0] ?? "",
    serviceAddresses,
    issueDate: row.issue_date,
    issued: formatDate(row.issue_date),
    due: formatDate(row.due_date),
    dueDate: row.due_date,
    serviceDate: row.service_date,
    documentStatus: mapInvoiceDocumentStatus(row.document_status),
    paymentStatus: mapInvoicePaymentStatus(row.payment_status),
    scope: row.scope_of_work ? row.scope_of_work.split("\n") : [],
    notes: row.customer_message ?? (row.separates_customer_fields ? "" : row.payment_instructions ?? ""),
    paymentInstructions: row.separates_customer_fields ? row.payment_instructions ?? undefined : undefined,
    internalNotes: row.internal_notes ?? undefined,
    terms: row.document_terms ?? undefined,
    reference: row.external_reference ?? undefined,
    billingName: row.billing_name ?? undefined,
    billingAddress: row.billing_address_text ?? (row.separates_customer_fields ? undefined : serviceAddresses[0]),
    recipientName: row.recipient_name ?? undefined,
    recipientEmail: row.recipient_email ?? undefined,
    items: mapLineItems(items),
    snapshot: row.issue_snapshot,
    draftVersion: row.draft_version,
    duplicateSource: row.duplicate_source,
    replacesInvoiceId: row.replaces_invoice_id,
    correctionReason: row.correction_reason ?? undefined,
    subtotal: row.subtotal,
    taxTotal: row.tax_total,
    total: row.total,
    amountPaid: row.amount_paid,
    balanceDue: row.balance_due,
    payments,
  };
}

async function getQuote(context: BusinessContext, id: string): Promise<Quote> {
  const [quote] = await listQuotes(context, id);
  if (!quote) throw new Error("Quote not found.");
  return quote;
}

export async function getJob(context: BusinessContext, id: string): Promise<Job> {
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
export async function listJobs(context: BusinessContext, recordId?: string): Promise<Job[]> {
  const supabase = await createClient();
  const jobsQuery = supabase.from("jobs").select(JOB_SELECT).eq("business_id", context.businessId);
  const recurrencesQuery = supabase.from("job_recurrences").select("job_id, frequency, interval_count").eq("business_id", context.businessId);
  const assignmentsQuery = supabase.from("job_assignments").select("job_id, profile_id, is_lead").eq("business_id", context.businessId);
  const attachmentsQuery = supabase.from("job_attachments").select("id, job_id, storage_bucket, storage_path, original_filename, caption, created_at").eq("business_id", context.businessId);
  const notesQuery = supabase.from("job_notes").select("id, job_id, body, created_by, created_at").eq("business_id", context.businessId);
  if (recordId) {
    jobsQuery.eq("id", recordId);
    recurrencesQuery.eq("job_id", recordId);
    assignmentsQuery.eq("job_id", recordId);
    attachmentsQuery.eq("job_id", recordId);
    notesQuery.eq("job_id", recordId);
  }
  const [rowsResult, recurrencesResult, assignmentsResult, profilesResult, attachmentsResult, notesResult, lookups] = await Promise.all([
    jobsQuery.order("scheduled_start", { ascending: true, nullsFirst: false }),
    recurrencesQuery,
    assignmentsQuery,
    supabase.from("profiles").select("id, display_name, email, role").eq("business_id", context.businessId).eq("is_active", true),
    attachmentsQuery.order("created_at", { ascending: false }),
    notesQuery.order("created_at", { ascending: false }),
    loadLookupMaps(context),
  ]);
  for (const result of [rowsResult, recurrencesResult, assignmentsResult, profilesResult, attachmentsResult, notesResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const rows = z.array(jobRowSchema).parse(rowsResult.data || []);
  const recurrences = z.array(recurrenceRowSchema).parse(recurrencesResult.data || []);
  const assignments = z.array(assignmentRowSchema).parse(assignmentsResult.data || []);
  const profiles = z.array(profileRowSchema).parse(profilesResult.data || []);
  const attachments = z.array(attachmentRowSchema).parse(attachmentsResult.data || []);
  const notes = z.array(z.object({
    id: z.uuid(), job_id: z.uuid(), body: z.string(), created_by: z.uuid(), created_at: z.string(),
  })).parse(notesResult.data || []);
  const recurrenceByJob = new Map(recurrences.map((row) => [row.job_id, row]));
  const assignmentsByJob = groupRows(assignments, (row) => row.job_id);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const notesByJob = groupRows(notes, (row) => row.job_id);
  const signedPhotos = await Promise.all(attachments.map(async (attachment): Promise<[string, JobPhoto]> => {
    const { data } = await supabase.storage.from(attachment.storage_bucket).createSignedUrl(attachment.storage_path, 60 * 60);
    return [attachment.job_id, {
      id: attachment.id,
      name: attachment.original_filename,
      url: data?.signedUrl || "",
      caption: attachment.caption || "",
      created: formatDate(attachment.created_at.slice(0, 10)),
    }];
  }));
  const photosByJob = groupRows(signedPhotos, ([jobId]) => jobId);
  return rows.map((row) => ({
    ...mapJob(row, lookups, recurrenceByJob.get(row.id), assignmentsByJob.get(row.id) || [], profileById,
      (photosByJob.get(row.id) || []).map(([, photo]) => photo)),
    fieldNotes: (notesByJob.get(row.id) || []).map((note) => {
      const author = profileById.get(note.created_by);
      return {
        id: note.id,
        body: note.body,
        author: author ? formatMemberDisplayName(author.display_name, author.email, author.role) : "Team member",
        created: formatScheduledDate(note.created_at).date,
      };
    }),
  }));
}
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
  const paymentBase = supabase.from("payments").select(INVOICE_PAYMENT_SELECT).eq("business_id", context.businessId);
  const [rowsResult, itemsResult, extrasResult, paymentsResult, lookups] = await Promise.all([
    invoicesQuery.order("issue_date", { ascending: false }),
    itemsQuery.order("position"),
    extrasQuery.order("position"),
    (recordId ? paymentBase.eq("invoice_id", recordId) : paymentBase).order("paid_at").order("created_at"),
    loadLookupMaps(context),
  ]);
  if (rowsResult.error) throw new Error(rowsResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (extrasResult.error) throw new Error(extrasResult.error.message);
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);
  const extras = z.array(z.object({ invoice_id: z.uuid(), client_address_id: z.uuid() })).parse(extrasResult.data || []);
  const payments = z.array(invoicePaymentRowSchema).parse(paymentsResult.data || []);
  const paymentsByInvoice = groupRows(payments, (row) => row.invoice_id);
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
      paymentsByInvoice.get(row.id) ?? [],
    ),
  );
}

export async function createQuote(context: BusinessContext, input: QuoteDraftInput): Promise<Quote> {
  const supabase = await createClient();
  const { directJobId, ...draft } = input;
  const { data, error } = directJobId
    ? await supabase.rpc("save_direct_job_quote", {
      target_business_id: context.businessId, target_job_id: directJobId, draft,
    })
    : await supabase.rpc("save_work_quote", { target_business_id: context.businessId, draft });
  if (error) throw new Error(error.message);
  return getQuote(context, z.uuid().parse(data));
}

export async function updateQuote(context: BusinessContext, input: QuoteDraftInput): Promise<Quote> {
  if (!input.id) throw new Error("Quote identifier is required.");
  return createQuote(context, input);
}

export async function reviseQuote(context: BusinessContext, id: string): Promise<Quote> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revise_work_quote", { target_business_id: context.businessId, target_quote_id: id });
  if (error) throw new Error(error.message);
  return getQuote(context, z.uuid().parse(data));
}

export async function updateQuoteStatus(context: BusinessContext, id: string, status: Quote["status"]): Promise<Quote> { const dbStatus = status === "Accepted" ? "approved" : status === "Declined" ? "declined" : status.toLowerCase(); const supabase = await createClient(); const { error } = await supabase.from("quotes").update({ status: dbStatus }).eq("business_id", context.businessId).eq("id", id); if (error) throw new Error(error.message); return getQuote(context, id); }
export async function deleteQuote(context: BusinessContext, id: string): Promise<{ id: string; job?: Job }> {
  const supabase = await createClient();
  const linked = await supabase.from("jobs").select("id").eq("business_id", context.businessId).eq("quote_id", id).maybeSingle();
  if (linked.error) throw new Error(linked.error.message);
  const { data, error } = await supabase.from("quotes").delete().eq("business_id", context.businessId).eq("id", id).select("id").single();
  if (error) throw new Error(error.message);
  return { id: z.object({ id: z.uuid() }).parse(data).id, job: linked.data ? await getJob(context, linked.data.id) : undefined };
}

export async function scheduleJob(context: BusinessContext, input: ScheduleJobInput): Promise<Job> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("schedule_work_job", { target_business_id: context.businessId, draft: input });
  if (error) throw new Error(error.message);
  return getJob(context, z.uuid().parse(data));
}

export async function updateJob(
  context: BusinessContext,
  input: JobUpdateInput,
): Promise<{ job: Job; nextJob?: Job }> {
  const supabase = await createClient();
  const recurrence = input.recurrence === "One-off" ? null : recurrenceToDb(input.recurrence);
  const dbStatus = input.status === "in-progress" ? "in_progress" : input.status === "on-hold" ? "paused" : input.status;
  const { data, error } = await supabase.rpc("update_work_job", {
    target_business_id: context.businessId,
    target_job_id: input.id,
    target_status: dbStatus,
    job_notes: input.notes,
    recurrence_frequency: recurrence?.frequency ?? null,
    recurrence_interval: recurrence?.intervalCount ?? null,
    change_schedule: input.scheduledStart !== undefined,
    new_start: input.scheduledStart ?? null,
    expected_updated_at: input.updatedAt ?? null,
  });
  if (error) throw new Error(error.message);
  const nextId = z.uuid().nullable().parse(data);
  const [job, nextJob] = await Promise.all([
    getJob(context, input.id),
    nextId ? getJob(context, nextId) : undefined,
  ]);
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

export async function updateJobAssignments(context: BusinessContext, input: JobAssignmentsInput): Promise<Job> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_work_job_assignments", {
    target_business_id: context.businessId,
    target_job_id: input.jobId,
    chosen_profiles: input.profileIds,
  });
  if (error) throw new Error(error.message);
  return getJob(context, z.uuid().parse(data));
}

export async function addJobNote(context: BusinessContext, input: JobNoteInput): Promise<Job> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_work_job_note", {
    target_business_id: context.businessId,
    target_job_id: input.jobId,
    new_note_id: input.noteId,
    note_body: input.body,
  });
  if (error) throw new Error(error.message);
  return getJob(context, input.jobId);
}

export async function uploadJobPhoto(context: BusinessContext, jobId: string, file: File, caption: string): Promise<JobPhoto> { await assertTechnicianAssigned(context, jobId); const supabase = await createClient(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "photo"; const storagePath = `${context.businessId}/${jobId}/${crypto.randomUUID()}-${safeName}`; const { error: uploadError } = await supabase.storage.from("job-attachments").upload(storagePath, file, { contentType: file.type, upsert: false }); if (uploadError) throw new Error(uploadError.message); const { data, error } = await supabase.from("job_attachments").insert({ business_id: context.businessId, job_id: jobId, storage_bucket: "job-attachments", storage_path: storagePath, original_filename: file.name, mime_type: file.type, byte_size: file.size, caption: caption || null, uploaded_by: context.actorId }).select("id, original_filename, caption, created_at").single(); if (error) { await supabase.storage.from("job-attachments").remove([storagePath]); throw new Error(error.message); } const row = z.object({ id: z.uuid(), original_filename: z.string(), caption: z.string().nullable(), created_at: z.string() }).parse(data); const { data: signed } = await supabase.storage.from("job-attachments").createSignedUrl(storagePath, 60 * 60); return { id: row.id, name: row.original_filename, url: signed?.signedUrl || "", caption: row.caption || "", created: formatDate(row.created_at.slice(0, 10)) }; }

export async function deleteJobPhoto(context: BusinessContext, jobId: string, photoId: string): Promise<string> { await assertTechnicianAssigned(context, jobId); const supabase = await createClient(); const { data, error: loadError } = await supabase.from("job_attachments").select("id, storage_bucket, storage_path").eq("business_id", context.businessId).eq("job_id", jobId).eq("id", photoId).single(); if (loadError) throw new Error(loadError.message); const row = z.object({ id: z.uuid(), storage_bucket: z.string(), storage_path: z.string() }).parse(data); const { error: deleteError } = await supabase.from("job_attachments").delete().eq("business_id", context.businessId).eq("job_id", jobId).eq("id", photoId); if (deleteError) throw new Error(deleteError.message); const { error: storageError } = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]); if (storageError) throw new Error(storageError.message); return row.id; }

export async function createInvoice(context: BusinessContext, input: InvoiceDraftInput): Promise<Invoice> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_invoice_draft", { draft: input });
  if (error) throw new Error(error.message);
  return getInvoice(context, z.uuid().parse(data));
}

export async function updateInvoice(context: BusinessContext, input: InvoiceDraftInput): Promise<Invoice> {
  if (!input.id) throw new Error("Invoice identifier is required.");
  return createInvoice(context, input);
}

export async function updateInvoicePayment(context: BusinessContext, input: InvoicePaymentInput): Promise<Invoice> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_invoice_payment", { payment: input });
  if (error) throw new Error(error.message);
  return getInvoice(context, z.uuid().parse(data));
}

async function transitionInvoice(id: string, action: "issue" | "sent" | "void" | "delete", expectedVersion?: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transition_invoice", {
    target_invoice: id,
    action,
    expected_version: expectedVersion,
  });
  if (error) throw new Error(error.message);
  return z.uuid().parse(data);
}

export async function finalizeInvoice(context: BusinessContext, id: string, expectedVersion: number): Promise<Invoice> {
  return getInvoice(context, await transitionInvoice(id, "issue", expectedVersion));
}

export async function markInvoiceAsSent(context: BusinessContext, id: string): Promise<Invoice> {
  return getInvoice(context, await transitionInvoice(id, "sent"));
}

export async function voidIssuedInvoice(context: BusinessContext, id: string): Promise<Invoice> {
  return getInvoice(context, await transitionInvoice(id, "void"));
}

export async function deleteInvoice(_context: BusinessContext, id: string): Promise<string> {
  return transitionInvoice(id, "delete");
}
