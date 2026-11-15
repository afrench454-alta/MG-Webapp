import { z } from "zod";
import { inlineClientSchema } from "./inline-client";

const isAtScale = (value: number, factor: number) =>
  Math.abs(value * factor - Math.round(value * factor)) < 0.00001;

export const invoiceDraftSchema = z.object({
  id: z.uuid().optional(),
  idempotencyKey: z.uuid(),
  expectedVersion: z.number().int().positive().optional(),
  clientId: z.uuid().optional(),
  inlineClient: inlineClientSchema.optional(),
  propertyId: z.uuid().optional(),
  extraPropertyIds: z.array(z.uuid()).max(20).optional(),
  jobId: z.uuid().optional(),
  requestId: z.uuid().optional(),
  quoteId: z.uuid().optional(),
  replacesInvoiceId: z.uuid().optional(),
  correctionReason: z.string().trim().min(1).max(1000).optional(),
  issueDate: z.iso.date(),
  dueDate: z.iso.date().optional(),
  serviceDate: z.iso.date().optional(),
  scope: z.string().trim().max(20_000).optional(),
  items: z.array(z.object({
    label: z.string().trim().max(160).optional(),
    description: z.string().trim().min(1).max(1_000),
    quantity: z.coerce.number().positive().max(100_000)
      .refine((value) => isAtScale(value, 1000), "Use up to three decimal places."),
    unitLabel: z.string().trim().max(32).optional(),
    rate: z.coerce.number().min(0).max(10_000_000)
      .refine((value) => isAtScale(value, 100), "Use up to two decimal places."),
  })).min(1).max(100),
  notes: z.string().trim().max(20_000),
  internalNotes: z.string().trim().max(20_000).optional(),
  terms: z.string().trim().max(20_000).optional(),
  paymentInstructions: z.string().trim().max(20_000).optional(),
  reference: z.string().trim().max(160).optional(),
  billingName: z.string().trim().max(160).optional(),
  billingAddress: z.string().trim().max(1000).optional(),
  recipientName: z.string().trim().max(160).optional(),
  recipientEmail: z.email().optional(),
}).refine((value) => Boolean(value.clientId) !== Boolean(value.inlineClient), "Choose one customer or add a new one.")
  .refine((value) => !value.id || value.expectedVersion !== undefined, "Reload the invoice before editing.")
  .refine((value) => !value.dueDate || value.dueDate >= value.issueDate, "Due date must be on or after the issue date.")
  .refine((value) => !value.replacesInvoiceId || (!value.id && Boolean(value.correctionReason)), "Enter a reason for the replacement.");

export const invoicePaymentMethods = ["cash", "bank_transfer", "card_external", "cheque", "other"] as const;

export const invoicePaymentSchema = z.object({
  invoiceId: z.string().min(1),
  idempotencyKey: z.uuid(),
  kind: z.enum(["receipt", "reversal", "refund"]),
  amount: z.number().positive().max(9_999_999_999.99)
    .refine((value) => isAtScale(value, 100), "Enter a payment amount with up to two decimal places."),
  paidOn: z.iso.date(),
  method: z.enum(invoicePaymentMethods),
  reference: z.string().trim().max(160).optional(),
  receiptId: z.uuid().optional(),
  reason: z.string().trim().min(1).max(1_000).optional(),
}).refine(
  (value) => value.kind === "receipt" ? !value.receiptId && !value.reason : Boolean(value.receiptId && value.reason),
  "Choose a receipt and enter a reason for the correction.",
);

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;
export type InvoicePaymentInput = z.infer<typeof invoicePaymentSchema>;
