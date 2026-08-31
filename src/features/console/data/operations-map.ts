import type { Invoice, JobStatus, Quote } from "../domain";

export function mapQuoteStatus(status: string): Quote["status"] {
  if (status === "approved") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "sent") return "Sent";
  if (status === "expired") return "Expired";
  if (status === "void") return "Void";
  return "Draft";
}

export function mapJobStatus(status: string): JobStatus {
  if (status === "in_progress") return "in-progress";
  if (status === "paused") return "on-hold";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "unscheduled") return "unscheduled";
  return "scheduled";
}

export function mapInvoicePaymentStatus(status: string): Invoice["paymentStatus"] {
  if (status === "paid") return "Paid";
  if (status === "partially_paid") return "Part paid";
  if (status === "refunded") return "Refunded";
  return "Unpaid";
}

export function mapInvoiceDocumentStatus(status: string): Invoice["documentStatus"] {
  if (status === "void") return "Void";
  if (status === "draft") return "Draft";
  if (status === "sent") return "Sent";
  if (status === "overdue") return "Overdue";
  return "Issued";
}
