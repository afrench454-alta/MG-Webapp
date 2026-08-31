import type { Invoice } from "../domain";
import { OperationsRuleError } from "./operations-rules";

export type InvoiceDisplayStatus =
  | "Draft"
  | "Issued"
  | "Sent"
  | "Overdue"
  | "Part paid"
  | "Paid"
  | "Refunded"
  | "Void";

const COLLECTABLE_DOCUMENTS: Invoice["documentStatus"][] = [
  "Issued",
  "Sent",
  "Overdue",
];

function brisbaneToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isPastDue(invoice: Invoice, now: Date): boolean {
  if (!invoice.dueDate) return false;
  return invoice.dueDate < brisbaneToday(now);
}

export function canDeleteInvoice(invoice: Invoice): boolean {
  return invoice.documentStatus === "Draft";
}

export function canFinalizeInvoice(invoice: Invoice): boolean {
  return invoice.documentStatus === "Draft";
}

export function canVoidInvoice(invoice: Invoice): boolean {
  if (invoice.documentStatus === "Draft" || invoice.documentStatus === "Void") {
    return false;
  }
  return invoice.paymentStatus === "Unpaid" || invoice.paymentStatus === "Part paid";
}

export function canMarkPaid(invoice: Invoice): boolean {
  if (invoice.documentStatus === "Void") return false;
  if (invoice.paymentStatus === "Paid" || invoice.paymentStatus === "Refunded") {
    return false;
  }
  return (
    invoice.documentStatus === "Draft" ||
    COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus)
  );
}

export function allowedPaymentStatuses(
  invoice: Invoice,
): Invoice["paymentStatus"][] {
  if (invoice.documentStatus === "Void") return [];
  if (invoice.paymentStatus === "Refunded") return ["Refunded"];
  if (invoice.paymentStatus === "Paid") return ["Paid", "Refunded"];
  return ["Unpaid", "Part paid", "Paid"];
}

export function invoiceDisplayStatus(
  invoice: Invoice,
  now: Date = new Date(),
): InvoiceDisplayStatus {
  if (invoice.documentStatus === "Void") return "Void";
  if (invoice.paymentStatus === "Refunded") return "Refunded";
  if (invoice.paymentStatus === "Paid") return "Paid";
  if (invoice.documentStatus === "Draft") return "Draft";
  if (
    COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus) &&
    (invoice.paymentStatus === "Unpaid" || invoice.paymentStatus === "Part paid") &&
    isPastDue(invoice, now)
  ) {
    return "Overdue";
  }
  if (invoice.paymentStatus === "Part paid") return "Part paid";
  if (invoice.documentStatus === "Sent") return "Sent";
  return "Issued";
}

export function applyInvoicePayment(
  invoice: Invoice,
  next: Invoice["paymentStatus"],
): Invoice {
  const allowed = allowedPaymentStatuses(invoice);
  if (invoice.documentStatus === "Void") {
    throw new OperationsRuleError("A voided invoice cannot have its payment status changed.");
  }
  if (!allowed.includes(next)) {
    throw new OperationsRuleError(
      `Cannot change payment from ${invoice.paymentStatus} to ${next}.`,
    );
  }
  if (
    invoice.documentStatus === "Draft" &&
    (next === "Paid" || next === "Part paid")
  ) {
    return { ...invoice, documentStatus: "Issued", paymentStatus: next };
  }
  return { ...invoice, paymentStatus: next };
}

export function markInvoicePaid(invoice: Invoice): Invoice {
  if (!canMarkPaid(invoice)) {
    throw new OperationsRuleError("This invoice cannot be marked paid.");
  }
  return applyInvoicePayment(
    invoice.documentStatus === "Draft"
      ? { ...invoice, documentStatus: "Issued" }
      : invoice,
    "Paid",
  );
}

export function voidInvoice(invoice: Invoice): Invoice {
  if (!canVoidInvoice(invoice)) {
    throw new OperationsRuleError(
      "Only issued unpaid invoices can be voided. Paid invoices can be refunded.",
    );
  }
  return { ...invoice, documentStatus: "Void" };
}

export function finalizeInvoiceRecord(invoice: Invoice): Invoice {
  if (!canFinalizeInvoice(invoice)) {
    throw new OperationsRuleError("Only draft invoices can be finalized.");
  }
  return { ...invoice, documentStatus: "Issued" };
}

export function toDbPaymentStatus(status: Invoice["paymentStatus"]): string {
  if (status === "Part paid") return "partially_paid";
  return status.toLowerCase();
}

export function toDbDocumentStatus(status: Invoice["documentStatus"]): string {
  return status.toLowerCase();
}
