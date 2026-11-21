import { lineItemSubtotal, type BusinessProfile, type Invoice } from "../domain";
import { invoicePaymentSchema, type InvoicePaymentInput } from "./invoice-contract";
import { OperationsRuleError } from "./operations-rules";

export type InvoiceDisplayStatus = "Draft" | "Issued" | "Sent" | "Overdue" | "Part paid" | "Paid" | "Refunded" | "Void";

const COLLECTABLE_DOCUMENTS: Invoice["documentStatus"][] = ["Issued", "Sent", "Overdue"];

function cents(value: number) {
  return Math.round(value * 100);
}

export const invoiceLineTotal = lineItemSubtotal;

export function invoiceAmounts(invoice: Invoice) {
  const subtotal = invoice.subtotal ?? invoice.items.reduce((sum, item) => sum + cents(invoiceLineTotal(item)), 0) / 100;
  const taxable = Math.max(0, subtotal - (invoice.discount ?? 0));
  const tax = invoice.taxTotal ?? cents(taxable * (invoice.taxRate ?? 0)) / 100;
  const total = invoice.total ?? taxable + tax;
  const amountPaid = invoice.amountPaid ?? 0;
  const balanceDue = invoice.documentStatus === "Void" ? 0 : invoice.balanceDue ?? Math.max(0, cents(total) - cents(amountPaid)) / 100;
  return { subtotal, tax, total, amountPaid, balanceDue };
}

export function brisbaneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function canDeleteInvoice(invoice: Invoice): boolean {
  return invoice.documentStatus === "Draft" && !invoice.replacesInvoiceId && !invoice.payments?.length;
}

export function canFinalizeInvoice(invoice: Invoice): boolean {
  return invoice.documentStatus === "Draft" && !invoice.duplicateSource;
}

export function canMarkSent(invoice: Invoice): boolean {
  return invoice.documentStatus === "Issued";
}

export function canVoidInvoice(invoice: Invoice): boolean {
  return COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus)
    && invoice.paymentStatus === "Unpaid"
    && !invoice.payments?.length;
}

export function canRecordPayment(invoice: Invoice): boolean {
  return COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus) && invoiceAmounts(invoice).balanceDue > 0;
}

export function availableInvoiceReceipts(invoice: Invoice) {
  if (!COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus)) return [];
  const payments = invoice.payments ?? [];
  const adjusted = new Map<string, number>();
  for (const entry of payments) {
    if (entry.receiptId) adjusted.set(entry.receiptId, (adjusted.get(entry.receiptId) ?? 0) + cents(entry.amount));
  }
  return payments.filter((entry) => entry.kind === "receipt" && entry.status === "recorded")
    .map((entry) => ({ ...entry, available: (cents(entry.amount) - (adjusted.get(entry.id) ?? 0)) / 100 }))
    .filter((entry) => entry.available > 0);
}

export function invoiceDisplayStatus(invoice: Invoice, now: Date = new Date()): InvoiceDisplayStatus {
  if (invoice.documentStatus === "Void") return "Void";
  if (invoice.documentStatus === "Draft") return "Draft";
  if (invoice.paymentStatus === "Refunded") return "Refunded";
  if (invoice.paymentStatus === "Paid") return "Paid";
  if (invoice.dueDate && invoice.dueDate < brisbaneToday(now) && invoiceAmounts(invoice).balanceDue > 0) return "Overdue";
  if (invoice.paymentStatus === "Part paid") return "Part paid";
  return invoice.documentStatus === "Sent" ? "Sent" : "Issued";
}

export function applyInvoicePaymentEntry(invoice: Invoice, input: InvoicePaymentInput): Invoice {
  input = invoicePaymentSchema.parse(input);
  if (input.invoiceId !== invoice.id) throw new OperationsRuleError("Invoice not found.");
  const payments = invoice.payments ?? [];
  const prior = payments.find((entry) => entry.idempotencyKey === input.idempotencyKey);
  if (prior) {
    if (prior.kind === input.kind && prior.amount === input.amount && prior.paidOn === input.paidOn
      && prior.method === input.method && prior.reference === input.reference && prior.reason === input.reason
      && prior.receiptId === input.receiptId) return invoice;
    throw new OperationsRuleError("That payment submission was already used. Open the payment form again.");
  }
  if (!COLLECTABLE_DOCUMENTS.includes(invoice.documentStatus)) {
    throw new OperationsRuleError("Payments require an issued invoice.");
  }
  if (input.paidOn > brisbaneToday()) throw new OperationsRuleError("The payment date cannot be in the future.");
  const amounts = invoiceAmounts(invoice);
  const isReceipt = input.kind === "receipt";
  if (isReceipt) {
    if (input.amount > amounts.balanceDue) throw new OperationsRuleError("The amount exceeds the outstanding balance.");
  } else {
    const target = availableInvoiceReceipts(invoice).find((entry) => entry.id === input.receiptId);
    if (!target || input.amount > target.available || input.paidOn < target.paidOn || input.amount > amounts.amountPaid) {
      throw new OperationsRuleError("The correction must fit the available receipt amount and be dated on or after the receipt.");
    }
  }
  const amountPaid = (cents(amounts.amountPaid) + (isReceipt ? 1 : -1) * cents(input.amount)) / 100;
  const balanceDue = Math.max(0, cents(amounts.total) - cents(amountPaid)) / 100;
  const hasRefund = input.kind === "refund" || payments.some((entry) => entry.kind === "refund");
  const paymentStatus = amountPaid > 0 ? (balanceDue === 0 ? "Paid" : "Part paid") : hasRefund ? "Refunded" : "Unpaid";
  return {
    ...invoice,
    amountPaid,
    balanceDue,
    paymentStatus,
    payments: [...payments, { ...input, id: input.idempotencyKey, status: input.kind === "refund" ? "refunded" : "recorded" }],
  };
}

export function voidInvoice(invoice: Invoice): Invoice {
  if (!canVoidInvoice(invoice)) throw new OperationsRuleError("Only issued invoices without payment history can be voided.");
  return { ...invoice, documentStatus: "Void", balanceDue: 0 };
}

export function finalizeInvoiceRecord(invoice: Invoice, profile?: BusinessProfile): Invoice {
  if (invoice.documentStatus !== "Draft") throw new OperationsRuleError("Only draft invoices can be issued.");
  return {
    ...invoice,
    documentStatus: "Issued",
    snapshot: profile ? {
      clientName: invoice.client,
      billingName: invoice.billingName,
      billingAddress: invoice.billingAddress,
      recipientName: invoice.recipientName,
      recipientEmail: invoice.recipientEmail,
      serviceAddresses: invoice.serviceAddresses ?? (invoice.address ? [invoice.address] : []),
      issuer: { ...profile },
    } : invoice.snapshot,
  };
}

export function markInvoiceSent(invoice: Invoice): Invoice {
  if (!canMarkSent(invoice)) throw new OperationsRuleError("Only issued invoices can be marked sent.");
  return { ...invoice, documentStatus: "Sent" };
}
