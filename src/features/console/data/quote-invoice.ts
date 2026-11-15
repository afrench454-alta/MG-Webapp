import { type Client, type Invoice, type Job, type JobRequest, type Quote } from "../domain";
import type { InvoiceDraft } from "../dialogs/invoice-form-dialog";
import { brisbaneToday } from "./invoice-lifecycle";

export function jobForQuote(quote: Quote, jobs: Job[], quotes: Quote[] = []) {
  let source: Quote | undefined = quote;
  const visited = new Set<string>();
  while (source && !visited.has(source.id)) {
    const job = jobs.find((job) => job.quoteId === source?.id && job.status !== "cancelled");
    if (job) return job;
    visited.add(source.id);
    const originalId: string | null | undefined = source.revisionOfQuoteId;
    source = originalId ? quotes.find((entry) => entry.id === originalId) : undefined;
  }
}

export function canCreateInvoiceFromQuote(quote: Quote, jobs: Job[] = [], quotes: Quote[] = []): boolean {
  const visit = jobForQuote(quote, jobs, quotes);
  return quote.status === "Accepted" && (!visit || visit.status === "completed");
}

export function liveInvoiceForQuote(quote: Quote, invoices: Invoice[], jobs: Job[] = [], quotes: Quote[] = []): Invoice | undefined {
  const visit = jobForQuote(quote, jobs, quotes);
  return invoices.find((invoice) => invoice.documentStatus !== "Void" && (
    invoice.quoteId === quote.id
    || (visit && (invoice.jobId === visit.id || (!invoice.jobId && invoice.quoteId === visit.quoteId)))
    || (!invoice.jobId && quote.jobRequestId && invoice.requestId === quote.jobRequestId)
  ));
}

export function invoiceConflict(draft: Partial<InvoiceDraft>, invoices: Invoice[]) {
  const original = draft.replacesInvoiceId ?? invoices.find((invoice) => invoice.id === draft.id)?.replacesInvoiceId;
  return invoices.find((invoice) => invoice.documentStatus !== "Void" && invoice.id !== draft.id
    && invoice.id !== original
    && (Boolean(draft.jobId && invoice.jobId === draft.jobId)
      || Boolean(draft.quoteId && invoice.quoteId === draft.quoteId)
      || Boolean(draft.requestId && invoice.requestId === draft.requestId && (!draft.jobId || !invoice.jobId))));
}

export function draftInvoiceFromQuote(quote: Quote, clients: Client[], jobs: Job[], quotes: Quote[] = []): InvoiceDraft {
  const client = clients.find((item) => item.id === quote.clientId);
  const property = client?.properties.find((item) => item.id === quote.serviceAddressId);
  const completed = jobs.filter((item) => item.status === "completed" && (
    item.quoteId === quote.id || (quote.jobRequestId && item.jobRequestId === quote.jobRequestId && !item.quoteId)
  ));
  const linked = jobForQuote(quote, jobs, quotes);
  const visit = linked ?? (completed.length === 1 ? completed[0] : undefined);
  const quoteNumber = quote.documentNumber || quote.id;
  return {
    clientId: client?.id ?? "",
    propertyId: property?.id ?? "",
    jobId: visit?.id,
    sourceLocked: Boolean(linked),
    requestId: quote.jobRequestId || visit?.jobRequestId || undefined,
    quoteId: quote.id,
    scope: quote.scope,
    items: quote.items.map((item) => ({ ...item })),
    notes: [quote.clientNotes, `Quoted as ${quoteNumber}.`].filter(Boolean).join("\n"),
    reference: quote.reference,
  };
}

export function draftInvoiceFromJob(job: Job): Partial<InvoiceDraft> {
  return {
    clientId: job.clientId ?? "",
    propertyId: job.serviceAddressId ?? "",
    jobId: job.id,
    requestId: job.jobRequestId ?? undefined,
    serviceDate: job.dateKey ? job.dateKey.slice(0, 10) : undefined,
    scope: job.scope,
    items: job.scope.trim() ? [{ description: job.scope, quantity: 1, rate: 0 }] : undefined,
  };
}

export function draftInvoiceFromRequest(request: JobRequest): Partial<InvoiceDraft> {
  return {
    clientId: request.clientId ?? "",
    propertyId: request.propertyId ?? "",
    requestId: request.id,
    scope: request.scope,
    items: request.scope.trim() ? [{ description: request.scope, quantity: 1, rate: 0 }] : undefined,
  };
}

export function draftInvoiceFromRecord(invoice: Invoice): InvoiceDraft {
  return {
    id: invoice.id,
    expectedVersion: invoice.draftVersion ?? 1,
    clientId: invoice.clientId || "",
    propertyId: invoice.serviceAddressId || "",
    extraPropertyIds: invoice.extraPropertyIds || [],
    jobId: invoice.jobId || undefined,
    requestId: invoice.requestId || undefined,
    quoteId: invoice.quoteId || undefined,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? "",
    serviceDate: invoice.serviceDate ?? "",
    scope: invoice.scope?.join("\n"),
    notes: invoice.notes,
    billingName: invoice.billingName,
    billingAddress: invoice.billingAddress,
    recipientName: invoice.recipientName,
    recipientEmail: invoice.recipientEmail,
    reference: invoice.reference,
    terms: invoice.terms,
    internalNotes: invoice.internalNotes,
    paymentInstructions: invoice.paymentInstructions,
    items: invoice.items.map((item) => ({ ...item })),
    sourceLocked: Boolean(invoice.replacesInvoiceId || invoice.duplicateSource),
  };
}

export function draftReplacementInvoice(invoice: Invoice): InvoiceDraft {
  return {
    ...draftInvoiceFromRecord(invoice),
    id: undefined,
    expectedVersion: undefined,
    issueDate: brisbaneToday(),
    dueDate: "",
    replacesInvoiceId: invoice.id,
    sourceLocked: true,
  };
}
