import type { ServiceCategory } from "./data/service-catalog";
import type { InlineClientInput } from "./data/inline-client";

export type { ServiceCategory } from "./data/service-catalog";

export type ConsoleRoute =
  | "today"
  | "dashboard"
  | "joseph"
  | "clients"
  | "requests"
  | "questionnaires"
  | "quotes"
  | "schedule"
  | "jobs"
  | "invoices"
  | "settings";

export type JobStatus =
  | "unscheduled"
  | "scheduled"
  | "in-progress"
  | "on-hold"
  | "completed"
  | "cancelled";

export type Property = {
  id?: string;
  name: string;
  address: string;
  cadence: string;
};

export type Client = {
  id: string;
  name: string;
  status: "Lead" | "Active" | "Inactive";
  phone: string;
  email: string;
  preferred: "Email" | "Phone" | "SMS";
  properties: Property[];
  notes: string;
};

export type LineItem = {
  label?: string;
  description: string;
  quantity: number | string;
  unitLabel?: string;
  rate: number | string;
};

export function formatLineQuantity(
  item: Pick<LineItem, "quantity" | "unitLabel">,
): string {
  const quantity = String(item.quantity ?? "").trim();
  const unit = item.unitLabel?.trim();
  if (!quantity) return "";
  return unit ? `${quantity} ${unit}` : quantity;
}

export type Quote = {
  id: string;
  updatedAt?: string;
  issueDate?: string;
  validUntil?: string | null;
  reference?: string;
  terms?: string;
  revisionOfQuoteId?: string | null;
  issuerSnapshot?: Pick<BusinessProfile, "name" | "abn" | "email" | "phone" | "website">;
  documentNumber?: string;
  clientId?: string;
  serviceAddressId?: string | null;
  jobRequestId?: string | null;
  client: string;
  address: string;
  issued: string;
  expires: string;
  validDays: number;
  status: "Draft" | "Sent" | "Accepted" | "Declined" | "Expired" | "Void";
  scope: string;
  clientNotes: string;
  internalNotes?: string;
  discount?: number;
  taxRate?: number;
  items: LineItem[];
};

export type InvoicePaymentMethod = "cash" | "bank_transfer" | "card_external" | "cheque" | "other";

export type InvoicePayment = {
  id: string;
  idempotencyKey?: string;
  kind: "receipt" | "reversal" | "refund";
  status: "recorded" | "voided" | "refunded";
  amount: number;
  paidOn: string;
  method: InvoicePaymentMethod;
  reference?: string;
  receiptId?: string;
  reason?: string;
};

export type InvoiceSnapshot = {
  clientName: string;
  billingName?: string;
  billingAddress?: string;
  recipientName?: string;
  recipientEmail?: string;
  serviceAddresses: string[];
  issuer: BusinessProfile;
};

export type Invoice = {
  requestId?: string | null;
  issueDate?: string;
  draftVersion?: number;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  amountPaid?: number;
  balanceDue?: number;
  payments?: InvoicePayment[];
  duplicateSource?: boolean;
  replacesInvoiceId?: string | null;
  correctionReason?: string;
  snapshot?: InvoiceSnapshot | null;
  billingName?: string;
  billingAddress?: string;
  recipientName?: string;
  recipientEmail?: string;
  reference?: string;
  serviceDate?: string | null;
  serviceAddresses?: string[];
  terms?: string;
  internalNotes?: string;
  paymentInstructions?: string;
  id: string;
  documentNumber?: string;
  clientId?: string;
  serviceAddressId?: string | null;
  jobId?: string | null;
  quoteId?: string | null;
  client: string;
  address: string;
  issued: string;
  due: string;
  dueDate?: string | null;
  documentStatus: "Draft" | "Issued" | "Sent" | "Overdue" | "Void";
  paymentStatus: "Unpaid" | "Part paid" | "Paid" | "Refunded";
  scope?: string[];
  extraPropertyIds?: string[];
  notes: string;
  discount?: number;
  taxRate?: number;
  items: LineItem[];
};

export type BusinessProfile = {
  name: string;
  abn: string;
  email: string;
  phone: string;
  website: string;
  paymentTo: string;
  bsb: string;
  accountNumber: string;
};

export const businessProfile: BusinessProfile = {
  name: "Mow & Glow Property Services",
  abn: "15 219 585 352",
  email: "team@mowglowpropertyservices.com.au",
  phone: "(+61) 400 856 532",
  website: "www.mowglowpropertyservices.com.au",
  paymentTo: "",
  bsb: "",
  accountNumber: "",
};

export const quoteTerms = "This quotation is an estimate only. Any unforeseen costs, additional materials, or extra labour required may result in additional charges. The client will be notified before any changes or additional work is carried out.";

export const invoiceTerms = "Invoices due upon completion have a grace period of 7 days only. Mow & Glow Property Services is a current ABN holder, carries public liability insurance, and is not registered for GST.";

export type Job = {
  id: string;
  updatedAt?: string;
  quoteId?: string | null;
  displayName: string;
  clientId?: string;
  serviceAddressId?: string | null;
  jobRequestId?: string | null;
  client: string;
  property: string;
  address: string;
  category: string;
  scope: string;
  date: string;
  time: string;
  dateKey: string;
  status: JobStatus;
  notes: string;
  recurrence: string;
  assigneeIds: string[];
  assignees: string[];
  photos: JobPhoto[];
  fieldNotes?: JobFieldNote[];
};

export type JobFieldNote = { id: string; body: string; author: string; created: string };

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Co-owner" | "Worker";
  isActive: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: "Co-owner" | "Worker";
  status: "Pending" | "Accepted" | "Revoked" | "Expired";
  created: string;
  expires: string;
};

export type JobPhoto = {
  id: string;
  name: string;
  url: string;
  caption: string;
  created: string;
};

export type QuestionnaireField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "radio" | "checkbox";
  required?: boolean;
  options?: string[];
};

export type Questionnaire = {
  id: string;
  category: string;
  title: string;
  description: string;
  count: number;
  tone: "sage" | "forest" | "olive" | "amber";
  fields: QuestionnaireField[];
};

export type QuestionnaireSubmission = {
  id: string;
  questionnaireId?: string;
  questionnaire: string;
  respondent: string;
  email: string;
  phone?: string;
  submitted: string;
  answers: Record<string, string | string[]>;
  jobRequestId?: string;
};

export type JobRequest = {
  id: string;
  clientId?: string;
  propertyId?: string;
  client: string;
  address: string;
  category: string;
  scope: string;
  status: "New" | "Qualified" | "Quoting" | "Scheduled" | "Closed" | "Rejected";
  previousStatus?: "New" | "Qualified" | "Quoting" | "Scheduled" | null;
  created: string;
  scheduled?: string;
  visit?: string;
};

export function markRequestScheduled(
  request: JobRequest,
  scheduled?: string,
): JobRequest {
  return {
    ...request,
    status: "Scheduled",
    scheduled: scheduled || request.scheduled,
  };
}

export type JobRequestDraft = {
  clientId?: string;
  propertyId?: string;
  inlineClient?: InlineClientInput;
  category: ServiceCategory;
  serviceDetail?: string;
  scope: string;
  questionnaireResponseId?: string;
};

export const clientsSeed: Client[] = [];
export const questionnaires: Questionnaire[] = [];
export const questionnaireSubmissionsSeed: QuestionnaireSubmission[] = [];
export const teamMembersSeed: TeamMember[] = [
  { id: "member-1", name: "Jodie", email: "team@mowglowpropertyservices.com.au", role: "Owner", isActive: true },
  { id: "member-2", name: "Ashton", email: "ashtonfrench454@gmail.com", role: "Co-owner", isActive: true },
];
export const initialJobRequests: JobRequest[] = [];
export const initialJobs: Job[] = [];
export const initialQuotes: Quote[] = [];
export const invoiceSeed: Invoice = {
  id: "INV-2026-2001",
  clientId: "client-1",
  serviceAddressId: "client-1-property-1",
  client: "Harper & Co",
  address: "1 Paperbark Street, Toowoomba",
  issued: "04 Aug 2026",
  due: "18 Aug 2026",
  dueDate: "2026-08-18",
  documentStatus: "Draft",
  paymentStatus: "Unpaid",
  scope: ["Deep clean 3BR", "Window cleaning"],
  notes: "Invoices are due upon completion with a 7-day grace period.",
  discount: 0,
  taxRate: 0,
  items: [
    { description: "Deep clean 3BR", quantity: 1, rate: 250 },
    { description: "Windows", quantity: 2, rate: 40 },
  ],
};

export const statusColumns: Array<{ id: JobStatus; label: string }> = [
  { id: "unscheduled", label: "Unscheduled" },
  { id: "scheduled", label: "Scheduled" },
  { id: "in-progress", label: "In Progress" },
  { id: "on-hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function money(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

function lineSubtotalCents(item: LineItem): number {
  // Match PostgreSQL three-decimal quantities, two-decimal prices and per-line rounding.
  const thousandths = Math.round(Number(item.quantity || 0) * 1000);
  const unitPriceCents = Math.round(Number(item.rate || 0) * 100);
  return Math.round((thousandths * unitPriceCents) / 1000);
}

export function lineItemSubtotal(item: LineItem): number {
  return lineSubtotalCents(item) / 100;
}

export function quoteTotals(items: LineItem[], discount = 0, taxRate = 0) {
  const subtotal = items.reduce((sum, item) => sum + lineSubtotalCents(item), 0) / 100;
  const discountedSubtotal = Math.max(0, subtotal - Math.max(0, discount));
  const tax = discountedSubtotal * Math.max(0, taxRate);
  return { subtotal, discount: Math.max(0, discount), taxRate: Math.max(0, taxRate), tax, total: discountedSubtotal + tax };
}
