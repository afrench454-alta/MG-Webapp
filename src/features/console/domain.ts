export type ConsoleRoute =
  | "dashboard"
  | "clients"
  | "requests"
  | "questionnaires"
  | "quotes"
  | "schedule"
  | "jobs"
  | "invoices";

export type JobStatus = "scheduled" | "in-progress" | "on-hold" | "completed";

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
  description: string;
  quantity: number | string;
  rate: number | string;
};

export type Quote = {
  id: string;
  documentNumber?: string;
  client: string;
  address: string;
  issued: string;
  expires: string;
  validDays: number;
  status: "Draft" | "Sent" | "Accepted" | "Declined";
  scope: string;
  clientNotes: string;
  discount?: number;
  taxRate?: number;
  items: LineItem[];
};

export type Invoice = {
  id: string;
  documentNumber?: string;
  client: string;
  address: string;
  issued: string;
  due: string;
  documentStatus: "Draft" | "Finalized" | "Void";
  paymentStatus: "Unpaid" | "Part paid" | "Paid" | "Void";
  scope?: string[];
  notes: string;
  discount?: number;
  taxRate?: number;
  items: LineItem[];
};

export const businessProfile = {
  name: "Mow & Glow Property Services",
  abn: "15 219 585 352",
  email: "team@mowglowpropertyservices.com.au",
  phone: "(+61) 400 856 532",
  website: "www.mowglowpropertyservices.com.au",
  paymentTo: "Jodie T/A Mow Glow PS",
  bsb: "084-961",
  accountNumber: "853110869",
} as const;

export const quoteTerms = "This quotation is an estimate only. Any unforeseen costs, additional materials, or extra labour required may result in additional charges. The client will be notified before any changes or additional work is carried out.";

export const invoiceTerms = "Invoices due upon completion have a grace period of 7 days only. Mow & Glow Property Services is a current ABN holder, carries public liability insurance, and is not registered for GST.";

export type Job = {
  id: string;
  displayName: string;
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
};

export type JobPhoto = {
  id: string;
  name: string;
  url: string;
  caption: string;
  created: string;
};

export type Questionnaire = {
  id: string;
  category: string;
  title: string;
  description: string;
  count: number;
  tone: "sage" | "forest" | "olive" | "amber";
};

export type QuestionnaireSubmission = {
  id: string;
  questionnaire: string;
  respondent: string;
  email: string;
  submitted: string;
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

export type ServiceCategory =
  | "Standard / General Clean"
  | "Bond Clean / End of Lease"
  | "Yard Cleanup"
  | "Property Maintenance";

export type JobRequestDraft = {
  clientId: string;
  propertyId: string;
  category: ServiceCategory;
  scope: string;
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
    category: "Standard / General Clean",
    title: "Standard / General Clean Assessment",
    description: "Lighter, general cleaning - ideal for routine or one-off house cleans.",
    count: 6,
    tone: "sage",
  },
  {
    id: "bond",
    category: "Bond Clean / End of Lease",
    title: "Bond Clean / End of Lease Questionnaire",
    description: "Detailed intake covering high-risk areas for a bond guarantee.",
    count: 6,
    tone: "forest",
  },
  {
    id: "yard",
    category: "Yard Cleanup",
    title: "Yard Cleanup & Property Overhaul",
    description: "Overgrown state, green waste, trees, edging and access.",
    count: 4,
    tone: "olive",
  },
  {
    id: "maintenance",
    category: "Property Maintenance",
    title: "Property Maintenance & Repair",
    description: "Minor repairs, handyman tasks, gutters, locks and fixtures.",
    count: 3,
    tone: "amber",
  },
];

export const initialJobRequests: JobRequest[] = [
  {
    id: "request-1",
    clientId: "client-2",
    client: "Northside Studio",
    propertyId: "client-2-property-2",
    address: "7 McCauley Drive, Booie",
    category: "Standard / General Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    status: "Scheduled",
    created: "05 Aug 2026",
    scheduled: "11 Aug 2026",
    visit: "04 Aug 2026",
  },
];

export const initialJobs: Job[] = [
  {
    id: "job-1",
    displayName: "Northside Studio · Owner Residence · 11 Aug 2026",
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Standard / General Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    date: "11 Aug 2026",
    time: "9:00 am",
    dateKey: "2026-08-11T09:00",
    status: "on-hold",
    notes: "",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
  },
  {
    id: "job-2",
    displayName: "Northside Studio · Owner Residence · 04 Aug 2026",
    client: "Northside Studio",
    property: "Owner Residence",
    address: "7 McCauley Drive, Booie",
    category: "Standard / General Clean",
    scope: "1 Bed, 2 Bath, 1 Kitchen, 1 Living, 1 Office",
    date: "04 Aug 2026",
    time: "9:00 am",
    dateKey: "2026-08-04T09:00",
    status: "completed",
    notes: "Completed without issues.",
    recurrence: "One-off",
    assigneeIds: [],
    assignees: [],
    photos: [],
  },
  {
    id: "job-3",
    displayName: "Northside Studio · Studio - Commercial · 11 Aug 2026",
    client: "Northside Studio",
    property: "Studio - Commercial",
    address: "4 Railway Terrace, Kingaroy",
    category: "Standard / General Clean",
    scope: "Regular commercial studio clean",
    date: "11 Aug 2026",
    time: "1:00 pm",
    dateKey: "2026-08-11T13:00",
    status: "scheduled",
    notes: "",
    recurrence: "Weekly",
    assigneeIds: [],
    assignees: [],
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
    items: [
      { description: "Labour", quantity: 2.5, rate: 120 },
      { description: "Carpet clean", quantity: 1, rate: 10 },
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
    items: [{ description: "Regular clean", quantity: 1, rate: 250 }],
  },
];

export const invoiceSeed: Invoice = {
  id: "INV-2026-2001",
  client: "Harper & Co",
  address: "1 Paperbark Street, Toowoomba",
  issued: "04 Aug 2026",
  due: "18 Aug 2026",
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
  { id: "scheduled", label: "Scheduled" },
  { id: "in-progress", label: "In Progress" },
  { id: "on-hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
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
