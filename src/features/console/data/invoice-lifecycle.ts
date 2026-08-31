import { quoteTotals, type Invoice } from "../domain";
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

export type InvoicePaymentWrite = {
  voidRecorded: boolean;
  insert: {
    amount: number;
    status: "recorded" | "refunded";
    method: "bank_transfer";
    notes: string;
  } | null;
};

const COLLECTABLE_DOCUMENTS: Invoice["documentStatus"][] = [
  "Issued",
  "Sent",
  "Overdue",
];

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function invoiceTotal(invoice: Pick<Invoice, "items" | "discount" | "taxRate">): number {
  return roundMoney(quoteTotals(invoice.items, invoice.discount ?? 0, invoice.taxRate ?? 0).total);
}

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

export function canMarkSent(invoice: Invoice): boolean {
  return invoice.documentStatus === "Issued";
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

export function markInvoiceSent(invoice: Invoice): Invoice {
  if (!canMarkSent(invoice)) {
    throw new OperationsRuleError("Only issued invoices can be marked sent.");
  }
  return { ...invoice, documentStatus: "Sent" };
}

/**
 * Postgres derives invoices.payment_status from payment rows.
 * Direct status updates are rejected by invoices_guard_derived_fields.
 */
export function planInvoicePaymentRecords(
  invoice: Pick<Invoice, "items" | "discount" | "taxRate">,
  next: Invoice["paymentStatus"],
  recordedSum = 0,
): InvoicePaymentWrite {
  const total = invoiceTotal(invoice);
  const recorded = roundMoney(Math.max(0, recordedSum));

  if (next === "Unpaid") {
    return { voidRecorded: recorded > 0, insert: null };
  }

  if (next === "Paid") {
    if (total <= 0) {
      throw new OperationsRuleError("This invoice has no amount to collect.");
    }
    const remaining = roundMoney(total - recorded);
    if (remaining <= 0) {
      return { voidRecorded: false, insert: null };
    }
    return {
      voidRecorded: false,
      insert: {
        amount: remaining,
        status: "recorded",
        method: "bank_transfer",
        notes: "Marked paid in console",
      },
    };
  }

  if (next === "Part paid") {
    if (total <= 0.01) {
      throw new OperationsRuleError("This invoice is too small to mark as part paid.");
    }
    if (recorded > 0 && recorded < total) {
      return { voidRecorded: false, insert: null };
    }
    const half = roundMoney(total / 2);
    const amount = roundMoney(Math.min(Math.max(half, 0.01), total - 0.01));
    return {
      voidRecorded: recorded > 0,
      insert: {
        amount,
        status: "recorded",
        method: "bank_transfer",
        notes: "Marked part paid in console",
      },
    };
  }

  return {
    voidRecorded: recorded > 0,
    insert: {
      amount: Math.max(total, 0.01),
      status: "refunded",
      method: "bank_transfer",
      notes: "Marked refunded in console",
    },
  };
}

export function toDbPaymentStatus(status: Invoice["paymentStatus"]): string {
  if (status === "Part paid") return "partially_paid";
  return status.toLowerCase();
}

export function toDbDocumentStatus(status: Invoice["documentStatus"]): string {
  return status.toLowerCase();
}
