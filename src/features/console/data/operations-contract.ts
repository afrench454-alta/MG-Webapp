import { z } from "zod";

import type { Invoice, Job, JobPhoto, Quote } from "../domain";

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(1_000),
  quantity: z.coerce.number().positive().max(100_000),
  rate: z.coerce.number().min(0).max(10_000_000),
});

export const quoteDraftSchema = z.object({
  jobRequestId: z.uuid(),
  scope: z.string().trim().min(1).max(20_000),
  items: z.array(lineItemSchema).min(1).max(100),
  clientNotes: z.string().trim().max(20_000),
  internalNotes: z.string().trim().max(20_000),
});

export const invoiceDraftSchema = z.object({
  clientId: z.uuid(),
  propertyId: z.uuid(),
  jobId: z.uuid().optional(),
  items: z.array(lineItemSchema).min(1).max(100),
  dueDays: z.coerce.number().int().min(0).max(365),
  notes: z.string().trim().max(20_000),
});

export const scheduleJobSchema = z.object({
  jobRequestId: z.uuid(),
  scheduledStart: z.string().datetime({ offset: true }),
});

export const jobUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["scheduled", "in-progress", "on-hold", "completed"]),
  notes: z.string().trim().max(20_000),
  recurrence: z.enum(["One-off", "Weekly", "Fortnightly", "Four-weekly", "Monthly"]),
});

export const jobAssignmentsSchema = z.object({
  jobId: z.uuid(),
  profileIds: z.array(z.uuid()).max(50),
});

export const quoteStatusSchema = z.enum(["Draft", "Sent", "Accepted", "Declined"]);
export const invoicePaymentStatusSchema = z.enum(["Unpaid", "Part paid", "Paid", "Void"]);

export type QuoteDraftInput = z.infer<typeof quoteDraftSchema>;
export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;
export type ScheduleJobInput = z.infer<typeof scheduleJobSchema>;
export type JobUpdateInput = z.infer<typeof jobUpdateSchema>;
export type JobAssignmentsInput = z.infer<typeof jobAssignmentsSchema>;

type ActionFailure = Readonly<{ ok: false; message: string }>;
export type QuoteActionResult = Readonly<{ ok: true; quote: Quote }> | ActionFailure;
export type JobActionResult = Readonly<{ ok: true; job: Job }> | ActionFailure;
export type InvoiceActionResult = Readonly<{ ok: true; invoice: Invoice }> | ActionFailure;
export type DeleteActionResult = Readonly<{ ok: true; id: string }> | ActionFailure;
export type JobPhotoActionResult = Readonly<{ ok: true; photo: JobPhoto }> | ActionFailure;

export type SaveQuoteAction = (input: QuoteDraftInput) => Promise<QuoteActionResult>;
export type UpdateQuoteStatusAction = (id: string, status: z.infer<typeof quoteStatusSchema>) => Promise<QuoteActionResult>;
export type DeleteQuoteAction = (id: string) => Promise<DeleteActionResult>;
export type ScheduleJobAction = (input: ScheduleJobInput) => Promise<JobActionResult>;
export type UpdateJobAction = (input: JobUpdateInput) => Promise<JobActionResult>;
export type UpdateJobAssignmentsAction = (input: JobAssignmentsInput) => Promise<JobActionResult>;
export type UploadJobPhotoAction = (formData: FormData) => Promise<JobPhotoActionResult>;
export type DeleteJobPhotoAction = (jobId: string, photoId: string) => Promise<DeleteActionResult>;
export type DeleteJobAction = (id: string) => Promise<DeleteActionResult>;
export type SaveInvoiceAction = (input: InvoiceDraftInput) => Promise<InvoiceActionResult>;
export type UpdateInvoicePaymentAction = (id: string, status: z.infer<typeof invoicePaymentStatusSchema>) => Promise<InvoiceActionResult>;
export type FinalizeInvoiceAction = (id: string) => Promise<InvoiceActionResult>;
export type DeleteInvoiceAction = (id: string) => Promise<DeleteActionResult>;
