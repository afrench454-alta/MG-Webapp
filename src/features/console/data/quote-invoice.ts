import { invoiceTerms, type Client, type Invoice, type Job, type Quote } from "../domain";
import type { InvoiceDraft } from "../dialogs/invoice-form-dialog";

export function canCreateInvoiceFromQuote(quote: Quote): boolean {
  return quote.status === "Accepted";
}

export function liveInvoiceForQuote(
  quote: Quote,
  invoices: Invoice[],
): Invoice | undefined {
  return invoices.find(
    (invoice) =>
      invoice.quoteId === quote.id && invoice.documentStatus !== "Void",
  );
}

export function draftInvoiceFromQuote(
  quote: Quote,
  clients: Client[],
  jobs: Job[],
): InvoiceDraft {
  const client =
    clients.find((item) => item.id === quote.clientId) ||
    clients.find((item) => item.name === quote.client);
  const property =
    client?.properties.find((item) => item.id === quote.serviceAddressId) ||
    client?.properties.find((item) => item.address === quote.address);
  const job =
    jobs.find(
      (item) => item.jobRequestId && item.jobRequestId === quote.jobRequestId,
    ) ||
    jobs.find(
      (item) => item.clientId === client?.id && item.address === quote.address,
    );

  const quoteNumber = quote.documentNumber || quote.id;
  return {
    clientId: client?.id || "",
    propertyId: property?.id || "",
    extraPropertyIds: [],
    jobId: job?.id,
    quoteId: quote.id,
    scope: quote.scope,
    items: quote.items.map((item) => ({ ...item })),
    dueDays: "7",
    notes: `${invoiceTerms}\nQuoted as ${quoteNumber}.`,
  };
}

export function draftInvoiceFromRecord(invoice: Invoice): InvoiceDraft {
  return {
    id: invoice.id,
    clientId: invoice.clientId || "",
    propertyId: invoice.serviceAddressId || "",
    extraPropertyIds: invoice.extraPropertyIds || [],
    jobId: invoice.jobId || undefined,
    quoteId: invoice.quoteId || undefined,
    scope: invoice.scope?.join("\n") || "",
    items: invoice.items.map((item) => ({ ...item })),
    dueDays: "7",
    notes: invoice.notes,
  };
}
