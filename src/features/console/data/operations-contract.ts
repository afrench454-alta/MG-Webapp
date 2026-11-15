import { z } from "zod";

import type { Client, Invoice, Job, JobPhoto, Quote } from "../domain";
import { inlineClientSchema } from "./inline-client";
import type { InvoiceDraftInput, InvoicePaymentInput } from "./invoice-contract";

const lineItemSchema = z.object({
  label: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1).max(1_000),
  quantity: z.coerce.number().positive().max(100_000),
  unitLabel: z.string().trim().max(32).optional(),
  rate: z.coerce.number().min(0).max(10_000_000),
});

const workCustomer = {
  jobRequestId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  propertyId: z.uuid().optional(),
  inlineClient: inlineClientSchema.optional(),
};

function hasOneWorkCustomer(input: z.infer<z.ZodObject<typeof workCustomer>>): boolean {
  return [input.jobRequestId, input.clientId, input.inlineClient].filter(Boolean).length === 1
    && (!input.propertyId || Boolean(input.clientId));
}

export const quoteDraftSchema = z.object({
  ...workCustomer,
  directJobId: z.uuid().optional(),
  id: z.uuid().optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  issueDate: z.iso.date().optional(),
  validUntil: z.iso.date().nullable().optional(),
  reference: z.string().trim().max(200).optional(),
  terms: z.string().trim().max(20_000).optional(),
  scope: z.string().trim().min(1).max(20_000),
  items: z.array(lineItemSchema).min(1).max(100),
  clientNotes: z.string().trim().max(20_000),
  internalNotes: z.string().trim().max(20_000),
}).refine((input) => input.directJobId
  ? !input.id && !input.jobRequestId && !input.clientId && !input.propertyId && !input.inlineClient
  : hasOneWorkCustomer(input), "Choose one job, client or job request.")
  .refine(({ issueDate, validUntil }) => !issueDate || !validUntil || validUntil >= issueDate, {
    path: ["validUntil"], message: "Expiry must be on or after the issue date.",
  });

export { invoiceDraftSchema, invoicePaymentSchema, invoicePaymentMethods } from "./invoice-contract";
export type { InvoiceDraftInput, InvoicePaymentInput } from "./invoice-contract";

export const scheduleJobSchema = z.object({
  ...workCustomer,
  category: z.string().trim().min(1).max(220).optional(),
  scope: z.string().trim().max(20_000).optional(),
  scheduledStart: z.string().datetime({ offset: true }),
  profileIds: z.array(z.uuid()).max(50).optional(),
}).refine(hasOneWorkCustomer, "Choose one client or job request.")
  .refine((input) => Boolean(input.jobRequestId || (input.category && (input.propertyId || input.inlineClient?.siteAddress))),
    "Choose a service and service address before scheduling.");

export const jobUpdateSchema = z.object({
  id: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(["unscheduled", "scheduled", "in-progress", "on-hold", "completed", "cancelled"]),
  notes: z.string().trim().max(20_000),
  recurrence: z.enum(["One-off", "Weekly", "Fortnightly", "Four-weekly", "Monthly"]),
  scheduledStart: z.string().datetime({ offset: true }).nullable().optional(),
});

export const jobAssignmentsSchema = z.object({
  jobId: z.uuid(),
  profileIds: z.array(z.uuid()).max(50),
});

export const jobNoteSchema = z.object({
  jobId: z.uuid(),
  noteId: z.uuid(),
  body: z.string().trim().min(1, "Enter a field note.").max(20_000),
});

export const quoteStatusSchema = z.enum(["Draft", "Sent", "Accepted", "Declined", "Expired", "Void"]);

export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>;
export type ScheduleJobInput = z.infer<typeof scheduleJobSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
export type JobAssignmentsInput = z.infer<typeof jobAssignmentsSchema>;
export type JobNoteInput = z.infer<typeof jobNoteSchema>;

type ActionFailure = Readonly<{ ok: false; message: string }>;
export type QuoteActionResult = Readonly<{ ok: true; quote: Quote; client?: Client; job?: Job }> | ActionFailure;
export type JobActionResult =
  | Readonly<{ ok: true; job: Job; nextJob?: Job; client?: Client }>
  | ActionFailure;
export type InvoiceActionResult = Readonly<{ ok: true; invoice: Invoice; client?: Client }> | ActionFailure;
export type DeleteActionResult = Readonly<{ ok: true; id: string }> | ActionFailure;
export type DeleteQuoteResult = Readonly<{ ok: true; id: string; job?: Job }> | ActionFailure;
export type JobPhotoActionResult = Readonly<{ ok: true; photo: JobPhoto }> | ActionFailure;

export type SaveQuoteAction = (input: QuoteDraftInput) => Promise<QuoteActionResult>;
export type UpdateQuoteStatusAction = (id: string, status: z.infer<typeof quoteStatusSchema>) => Promise<QuoteActionResult>;
export type DeleteQuoteAction = (id: string) => Promise<DeleteQuoteResult>;
export type ReviseQuoteAction = (id: string) => Promise<QuoteActionResult>;
export type ScheduleJobAction = (input: ScheduleJobInput) => Promise<JobActionResult>;
export type UpdateJobAction = (input: JobUpdateInput) => Promise<JobActionResult>;
export type UpdateJobAssignmentsAction = (input: JobAssignmentsInput) => Promise<JobActionResult>;
export type AddJobNoteAction = (input: JobNoteInput) => Promise<JobActionResult>;
export type UploadJobPhotoAction = (formData: FormData) => Promise<JobPhotoActionResult>;
export type DeleteJobPhotoAction = (jobId: string, photoId: string) => Promise<DeleteActionResult>;
export type DeleteJobAction = (id: string) => Promise<DeleteActionResult>;
export type SaveInvoiceAction = (input: InvoiceDraftInput) => Promise<InvoiceActionResult>;
export type UpdateInvoicePaymentAction = (input: InvoicePaymentInput) => Promise<InvoiceActionResult>;
export type FinalizeInvoiceAction = (id: string, expectedVersion: number) => Promise<InvoiceActionResult>;
export type MarkInvoiceSentAction = (id: string) => Promise<InvoiceActionResult>;
export type VoidInvoiceAction = (id: string) => Promise<InvoiceActionResult>;
export type DeleteInvoiceAction = (id: string) => Promise<DeleteActionResult>;
