import type { Client, Invoice, JobRequest, Quote } from "../domain";
import { invoiceDisplayStatus } from "./invoice-lifecycle";

export const invoiceFilterIds = ["live", "open", "paid", "voided"] as const;
export type InvoiceFilterId = (typeof invoiceFilterIds)[number];

export const quoteFilterIds = ["live", "open", "accepted", "voided"] as const;
export type QuoteFilterId = (typeof quoteFilterIds)[number];

export const requestFilterIds = ["all", "open", "scheduled", "closed"] as const;
export type RequestFilterId = (typeof requestFilterIds)[number];

export const clientFilterIds = ["all", "active", "leads", "inactive"] as const;
export type ClientFilterId = (typeof clientFilterIds)[number];

export function isLiveInvoice(invoice: Invoice): boolean {
  return invoice.documentStatus !== "Void";
}

export function isLiveQuote(quote: Quote): boolean {
  return quote.status !== "Void";
}

export function matchesInvoiceFilter(
  invoice: Invoice,
  filter: InvoiceFilterId,
): boolean {
  const display = invoiceDisplayStatus(invoice);
  if (filter === "voided") return display === "Void";
  if (display === "Void") return false;
  if (filter === "live") return true;
  if (filter === "paid") return display === "Paid" || display === "Refunded";
  return ["Draft", "Issued", "Sent", "Overdue", "Part paid"].includes(display);
}

export function matchesQuoteFilter(quote: Quote, filter: QuoteFilterId): boolean {
  if (filter === "voided") return quote.status === "Void";
  if (quote.status === "Void") return false;
  if (filter === "live") return true;
  if (filter === "open") return quote.status === "Draft" || quote.status === "Sent";
  return quote.status === "Accepted";
}

export function matchesRequestFilter(
  request: JobRequest,
  filter: RequestFilterId,
): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") return request.status === "Scheduled";
  if (filter === "closed") {
    return request.status === "Closed" || request.status === "Rejected";
  }
  return (
    request.status === "New" ||
    request.status === "Qualified" ||
    request.status === "Quoting"
  );
}

export function matchesClientFilter(
  client: Client,
  filter: ClientFilterId,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return client.status === "Active";
  if (filter === "leads") return client.status === "Lead";
  return client.status === "Inactive";
}

export function countMatching<T, F extends string>(
  records: T[],
  ids: readonly F[],
  matches: (record: T, filter: F) => boolean,
): Record<F, number> {
  return Object.fromEntries(
    ids.map((id) => [id, records.filter((record) => matches(record, id)).length]),
  ) as Record<F, number>;
}
