import type { Invoice, Job, Quote } from "../domain";

export class OperationsRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationsRuleError";
  }
}

const INVOICE_DELETE_BLOCKED =
  "Issued invoices cannot be deleted. Void them instead.";
const INVOICE_EDIT_BLOCKED =
  "Only draft invoices can be edited. Issued invoices must be voided and created again.";
const QUOTE_EDIT_BLOCKED =
  "Only draft quotes can be edited. Sent quotes can be voided instead.";
const JOB_DELETE_BLOCKED =
  "This job has operational history. It must be cancelled or edited instead of deleted.";
const VOID_PAYMENT_BLOCKED = "A voided invoice cannot have its payment status changed.";

export function assertInvoiceCanBeDeleted(
  invoice: Pick<Invoice, "documentStatus">,
): void {
  if (invoice.documentStatus !== "Draft") {
    throw new OperationsRuleError(INVOICE_DELETE_BLOCKED);
  }
}

export function assertInvoiceCanBeEdited(
  invoice: Pick<Invoice, "documentStatus">,
): void {
  if (invoice.documentStatus !== "Draft") {
    throw new OperationsRuleError(INVOICE_EDIT_BLOCKED);
  }
}

export function assertQuoteCanBeEdited(
  quote: Pick<Quote, "status">,
): void {
  if (quote.status !== "Draft") {
    throw new OperationsRuleError(QUOTE_EDIT_BLOCKED);
  }
}

export function assertJobCanBeDeleted(
  job: Pick<Job, "status" | "notes" | "photos">,
): void {
  const hasNotes = Boolean(job.notes?.trim());
  const hasPhotos = job.photos.length > 0;
  const schedulable = job.status === "scheduled" || job.status === "unscheduled";
  if (!schedulable || hasNotes || hasPhotos) {
    throw new OperationsRuleError(JOB_DELETE_BLOCKED);
  }
}

export function assertPaymentCanUpdate(
  invoice: Pick<Invoice, "documentStatus" | "paymentStatus">,
): void {
  if (invoice.documentStatus === "Void" || invoice.paymentStatus === "Refunded") {
    throw new OperationsRuleError(VOID_PAYMENT_BLOCKED);
  }
}
