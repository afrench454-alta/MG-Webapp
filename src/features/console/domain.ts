import type { ServiceCategory } from "./data/service-catalog";

export type { ServiceCategory } from "./data/service-catalog";

export type ConsoleRoute =
  | "dashboard"
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
  discount?: number;
  taxRate?: number;
  items: LineItem[];
};

export type Invoice = {
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
  paymentTo: "Jodie T/A Mow Glow PS",
  bsb: "084-961",
  accountNumber: "853110869",
};

export const quoteTerms = "This quotation is an estimate only. Any unforeseen costs, additional materials, or extra labour required may result in additional charges. The client will be notified before any changes or additional work is carried out.";

export const invoiceTerms = "Invoices due upon completion have a grace period of 7 days only. Mow & Glow Property Services is a current ABN holder, carries public liability insurance, and is not registered for GST.";

export type Job = {
  id: string;
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
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Co-owner" | "Technician";
  isActive: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: "Co-owner" | "Technician";
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
  created: string;
  scheduled?: string;
  visit?: string;
};

export type JobRequestDraft = {
  clientId: string;
  propertyId: string;
  category: ServiceCategory;
  serviceDetail?: string;
  scope: string;
  questionnaireResponseId?: string;
};

export const clientsSeed: Client[] = [
  {
    id: "client-1",
    name: "Harper & Co",
    status: "Lead",
    phone: "+61 400 111 333",
    email: "hello@harperandco.example",
    preferred: "Email",
    properties: [{ id: "client-1-property-1", name: "Home", address: "1 Paperbark Street, Toowoomba", cadence: "One-off" }],
    notes: "New enquiry from the public questionnaire.",
  },
  {
    id: "client-2",
    name: "Northside Studio",
    status: "Active",
    phone: "+61 400 778 874",
    email: "admin@northsidestudio.example",
    preferred: "Phone",
    properties: [
      { id: "client-2-property-1", name: "Studio - Commercial", address: "4 Railway Terrace, Kingaroy", cadence: "Every Tuesday" },
      { id: "client-2-property-2", name: "Owner Residence", address: "7 McCauley Drive, Booie", cadence: "Every Tuesday" },
    ],
    notes: "Valued, recurring customer.",
  },
];

export const questionnaires: Questionnaire[] = [
  {
    id: "standard",
    category: "Cleaning Services",
    title: "Cleaning Services Assessment",
    description: "General, bond, and deep cleans — pick the right intake for the job.",
    count: 4,
    tone: "sage",
    fields: [
      { id: "property_type", label: "Property type", type: "radio", required: true, options: ["Unit / apartment", "House", "Commercial", "Other"] },
      { id: "bedrooms", label: "Bedrooms or work areas", type: "text", required: true },
      { id: "priorities", label: "Priority areas", type: "checkbox", options: ["Kitchen", "Bathrooms", "Floors", "Windows"] },
      { id: "details", label: "Anything else we should know?", type: "textarea" },
    ],
  },
  {
    id: "bond",
    category: "Cleaning Services",
    title: "Bond Clean / End of Lease Questionnaire",
    description: "Detailed intake covering high-risk areas for a bond guarantee.",
    count: 4,
    tone: "forest",
    fields: [
      { id: "property", label: "Property type and size", type: "text", required: true },
      { id: "vacate_date", label: "Vacate or handover date", type: "text", required: true },
      { id: "condition", label: "Current condition", type: "radio", required: true, options: ["Light", "Average", "Heavy"] },
      { id: "extras", label: "Extra services needed", type: "checkbox", options: ["Carpets", "Oven", "Windows", "Walls"] },
    ],
  },
  {
    id: "yard",
    category: "Yard Services",
    title: "Yard Services Questionnaire",
    description: "Overgrown state, green waste, trees, edging and access.",
    count: 3,
    tone: "olive",
    fields: [
      { id: "yard_size", label: "Approximate yard size", type: "text", required: true },
      { id: "work", label: "Work required", type: "checkbox", required: true, options: ["Mowing", "Edging", "Pruning", "Green waste", "Weeding"] },
      { id: "access", label: "Access and equipment restrictions", type: "textarea" },
    ],
  },
  {
    id: "maintenance",
    category: "Property Maintenance",
    title: "Property Maintenance & Repair",
    description: "Minor repairs, handyman tasks, gutters, locks and fixtures.",
    count: 3,
    tone: "amber",
    fields: [
      { id: "work", label: "Work or repair required", type: "textarea", required: true },
      { id: "urgency", label: "Urgency", type: "radio", required: true, options: ["Routine", "Soon", "Urgent"] },
      { id: "access", label: "Access, safety or material notes", type: "textarea" },
    ],
  },
];

export const questionnaireSubmissionsSeed: QuestionnaireSubmission[] = [
  {
    id: "submission-1",
    questionnaireId: "bond",
    questionnaire: "Bond Clean / End of Lease Questionnaire",
    respondent: "Harper & Co",
    email: "hello@harperandco.example",
    phone: "+61 400 111 333",
    submitted: "05 Aug 2026",
    answers: {
      _site_address: "1 Paperbark Street, Toowoomba",
      property: "3 bed / 2 bath house",
      vacate_date: "22 Aug 2026",
      condition: "Average",
      extras: ["Carpets", "Oven"],
    },
  },
];

export const teamMembersSeed: TeamMember[] = [
  { id: "member-1", name: "Jodie", email: "team@mowglowpropertyservices.com.au", role: "Owner", isActive: true },
  { id: "member-2", name: "Alex", email: "alex@mowglowpropertyservices.com.au", role: "Technician", isActive: true },
];

export const initialJobRequests: JobRequest[] = [
  {
    id: "request-1",
    clientId: "client-2",
    client: "Northside Studio",
    propertyId: "client-2-property-2",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · General Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    status: "Scheduled",
    created: "05 Sep 2026",
    scheduled: "08 Sep 2026",
    visit: "01 Sep 2026",
  },
  {
    id: "request-2",
    clientId: "client-2",
    client: "Northside Studio",
    propertyId: "client-2-property-1",
    address: "4 Railway Terrace, Kingaroy",
    category: "Cleaning Services · General Clean",
    scope: "Regular commercial studio clean",
    status: "Scheduled",
    created: "05 Sep 2026",
    scheduled: "08 Sep 2026",
  },
];

export const initialJobs: Job[] = [
  {
    id: "job-1",
    displayName: "Northside Studio · 7 McCauley Drive, Booie · 08 Sep 2026",
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · General Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    date: "08 Sep 2026",
    time: "9:00 am",
    dateKey: "2026-09-08T09:00",
    clientId: "client-2",
    serviceAddressId: "client-2-property-2",
    jobRequestId: "request-1",
    status: "on-hold",
    notes: "",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
  },
  {
    id: "job-2",
    displayName: "Northside Studio · 7 McCauley Drive, Booie · 01 Sep 2026",
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Cleaning Services · Bond Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    date: "01 Sep 2026",
    time: "9:00 am",
    dateKey: "2026-09-01T09:00",
    clientId: "client-2",
    serviceAddressId: "client-2-property-2",
    status: "completed",
    notes: "Completed without issues.",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
  },
  {
    id: "job-3",
    displayName: "Northside Studio · 4 Railway Terrace, Kingaroy · 08 Sep 2026",
    client: "Northside Studio",
    property: "Studio - Commercial",
    address: "4 Railway Terrace, Kingaroy",
    category: "Cleaning Services · General Clean",
    scope: "Regular commercial studio clean",
    date: "08 Sep 2026",
    time: "1:00 pm",
    dateKey: "2026-09-08T13:00",
    clientId: "client-2",
    serviceAddressId: "client-2-property-1",
    jobRequestId: "request-2",
    status: "scheduled",
    notes: "",
    recurrence: "Weekly",
    assigneeIds: ["member-2"],
    assignees: ["Alex"],
    photos: [],
  },
];

export const initialQuotes: Quote[] = [
  {
    id: "QT-2026-1002",
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "05 Aug 2026",
    expires: "19 Aug 2026",
    validDays: 14,
    status: "Accepted",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    clientNotes: "Please contact us if you wish to amend any items on this quote.",
    discount: 0,
    taxRate: 0,
    clientId: "client-2",
    serviceAddressId: "client-2-property-2",
    jobRequestId: "request-1",
    items: [
      { description: "Labour", quantity: 2.5, unitLabel: "hrs", rate: 120 },
      { description: "Carpet clean", quantity: 1, unitLabel: "ea", rate: 10 },
    ],
  },
  {
    id: "QT-2026-1001",
    client: "Northside Studio",
    address: "7 McCauley Drive, Booie",
    issued: "04 Aug 2026",
    expires: "18 Aug 2026",
    validDays: 14,
    status: "Accepted",
    scope: "Regular studio clean",
    clientNotes: "Ongoing service timing can be adjusted to suit the property.",
    discount: 0,
    taxRate: 0,
    clientId: "client-2",
    serviceAddressId: "client-2-property-2",
    items: [{ description: "Regular clean", quantity: 1, unitLabel: "ea", rate: 250 }],
  },
];

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

export function quoteTotals(items: LineItem[], discount = 0, taxRate = 0) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0),
    0,
  );
  const discountedSubtotal = Math.max(0, subtotal - Math.max(0, discount));
  const tax = discountedSubtotal * Math.max(0, taxRate);
  return { subtotal, discount: Math.max(0, discount), taxRate: Math.max(0, taxRate), tax, total: discountedSubtotal + tax };
}
