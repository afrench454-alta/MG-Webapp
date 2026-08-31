import type { Invoice, Job } from "../domain";
import type { InvoiceDraftInput } from "./operations-contract";

export class OperationsRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationsRuleError";
  }
}

const INVOICE_DELETE_BLOCKED =
  "Issued invoices cannot be deleted. Void them instead.";
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

export function invoiceCreateRpcArgs(input: InvoiceDraftInput) {
  const extras = (input.extraPropertyIds ?? []).filter(
    (id) => id !== input.propertyId,
  );

  return {
    target_client_id: input.clientId,
    primary_address_id: input.propertyId,
    service_address_ids: extras,
    target_job_id: input.jobId ?? null,
    due_days: input.dueDays,
    invoice_notes: input.notes,
    invoice_items: input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
    })),
  };
}
