"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  Dispatch,
  FormEvent,
  MouseEvent,
  ReactNode,
  SetStateAction,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Columns3,
  DollarSign,
  Eye,
  FileCheck2,
  FileText,
  GripVertical,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "./console.css";
import {
  businessProfile,
  clientsSeed,
  initialJobRequests,
  initialJobs,
  initialQuotes,
  invoiceTerms,
  invoiceSeed as invoice,
  money,
  questionnaires,
  quoteTerms,
  quoteTotals,
  statusColumns,
} from "./domain";
import type {
  Client,
  ConsoleRoute,
  Invoice,
  Job,
  JobPhoto,
  JobRequest,
  JobRequestDraft,
  JobStatus,
  LineItem,
  Property,
  Questionnaire,
  QuestionnaireSubmission,
  Quote,
  TeamMember,
} from "./domain";
import type {
  ArchiveClientAction,
  SaveClientAction,
} from "./data/client-contract";
import type { DeleteJobRequestAction, SaveJobRequestAction } from "./data/job-request-contract";
import type { DeleteInvoiceAction, DeleteJobAction, DeleteJobPhotoAction, DeleteQuoteAction, FinalizeInvoiceAction, SaveInvoiceAction, SaveQuoteAction, ScheduleJobAction, UpdateInvoicePaymentAction, UpdateJobAction, UpdateJobAssignmentsAction, UpdateQuoteStatusAction, UploadJobPhotoAction } from "./data/operations-contract";
import type { SendQuestionnaireAction } from "./data/questionnaire-contract";

const navItems: Array<{ id: ConsoleRoute; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "clients", label: "Clients", icon: Users },
  { id: "requests", label: "Job Requests", icon: ClipboardList },
  { id: "questionnaires", label: "Questionnaires", icon: FileText },
  { id: "quotes", label: "Quotes", icon: ReceiptText },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "jobs", label: "Job Board", icon: Columns3 },
  { id: "invoices", label: "Invoices", icon: DollarSign },
];

type BadgeTone =
  | "neutral"
  | "sage"
  | "forest"
  | "olive"
  | "amber"
  | "success"
  | "unpaid";

type ButtonVariant = "primary" | "secondary" | "success" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
};

type DialogProps = {
  title: string;
  titleIcon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  document?: boolean;
};

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
};

type QuoteDraft = {
  jobRequestId: string;
  scope: string;
  items: LineItem[];
  clientNotes: string;
  internalNotes: string;
};

type InvoiceDraft = {
  clientId: string;
  propertyId: string;
  jobId?: string;
  items: LineItem[];
  dueDays: string;
  notes: string;
};

type DialogState =
  | { type: "estimator" }
  | { type: "client"; client?: Client }
  | { type: "delete-client"; client: Client }
  | { type: "delete-request"; request: JobRequest }
  | { type: "delete-quote"; quote: Quote }
  | { type: "delete-job"; job: Job }
  | { type: "delete-invoice"; record: Invoice }
  | { type: "quote-form" }
  | { type: "invoice-form" }
  | { type: "send-questionnaire" }
  | { type: "public-questionnaire"; questionnaire: Questionnaire }
  | { type: "schedule" }
  | { type: "job"; job: Job }
  | { type: "quote-document"; quote: Quote }
  | { type: "invoice-document"; record: Invoice }
  | { type: "request" };

type ConsoleAppProps = {
  initialClients?: Client[];
  initialJobRequests?: JobRequest[];
  initialQuestionnaires?: Questionnaire[];
  initialQuestionnaireSubmissions?: QuestionnaireSubmission[];
  initialQuotes?: Quote[];
  initialJobs?: Job[];
  teamMembers?: TeamMember[];
  initialInvoices?: Invoice[];
  dataMode?: "demo" | "live";
  signedInEmail?: string;
  canManageClients?: boolean;
  canManageRequests?: boolean;
  onSaveClient?: SaveClientAction;
  onArchiveClient?: ArchiveClientAction;
  onSaveJobRequest?: SaveJobRequestAction;
  onDeleteJobRequest?: DeleteJobRequestAction;
  onSaveQuote?: SaveQuoteAction;
  onUpdateQuoteStatus?: UpdateQuoteStatusAction;
  onDeleteQuote?: DeleteQuoteAction;
  onScheduleJob?: ScheduleJobAction;
  onUpdateJob?: UpdateJobAction;
  onUpdateJobAssignments?: UpdateJobAssignmentsAction;
  onUploadJobPhoto?: UploadJobPhotoAction;
  onDeleteJobPhoto?: DeleteJobPhotoAction;
  onDeleteJob?: DeleteJobAction;
  onSaveInvoice?: SaveInvoiceAction;
  onUpdateInvoicePayment?: UpdateInvoicePaymentAction;
  onFinalizeInvoice?: FinalizeInvoiceAction;
  onDeleteInvoice?: DeleteInvoiceAction;
  onSendQuestionnaire?: SendQuestionnaireAction;
  onSignOut?: () => Promise<void>;
};

function quoteStatusTone(status: Quote["status"]): BadgeTone {
  if (status === "Accepted") return "success";
  if (status === "Sent") return "olive";
  if (status === "Declined") return "amber";
  return "neutral";
}

function paymentStatusTone(status: Invoice["paymentStatus"]): BadgeTone {
  if (status === "Paid") return "success";
  if (status === "Part paid") return "amber";
  if (status === "Void") return "neutral";
  return "unpaid";
}

function Button({ children, variant = "primary", icon: Icon, className = "", ...props }: ButtonProps) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.9} /> : null}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ label, icon: Icon, tone = "default", className = "", ...props }: IconButtonProps) {
  return (
    <button className={`icon-button icon-button--${tone} ${className}`} aria-label={label} title={label} {...props}>
      <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
    </button>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

function Dialog({ title, titleIcon: TitleIcon, onClose, children, wide = false, document: isDocument = false }: DialogProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && onClose()}>
      <section
        className={`dialog ${wide ? "dialog--wide" : ""} ${isDocument ? "dialog--document" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={panelRef}
      >
        <div className="dialog__header">
          <h2 id="dialog-title">{TitleIcon ? <TitleIcon aria-hidden="true" size={19} /> : null}{title}</h2>
          <IconButton label="Close dialog" icon={X} onClick={onClose} />
        </div>
        <div className="dialog__body">{children}</div>
      </section>
    </div>
  );
}

function Field({ label, required, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function Sidebar({ active, onNavigate, onEstimate, mobileOpen, onClose, signedInEmail, onSignOut }: { active: ConsoleRoute; onNavigate: (route: ConsoleRoute) => void; onEstimate: () => void; mobileOpen: boolean; onClose: () => void; signedInEmail: string; onSignOut?: () => Promise<void> }) {
  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
      <div className="brand-lockup">
        <p>FieldCentral</p>
        <strong>Pro Console</strong>
        <IconButton label="Close navigation" icon={X} className="sidebar__close" onClick={onClose} />
      </div>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={active === item.id ? "is-active" : ""}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="ai-button" type="button" onClick={onEstimate}>
          <Sparkles aria-hidden="true" size={18} />
          <span>AI Estimator</span>
        </button>
        <div className="signed-in">
          <p className="eyebrow">Signed in</p>
          <strong>{signedInEmail}</strong>
          {onSignOut ? (
            <form action={onSignOut}>
              <button type="submit">
                <LogOut aria-hidden="true" size={16} /> Sign out
              </button>
            </form>
          ) : (
            <button type="button">
              <LogOut aria-hidden="true" size={16} /> Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function Dashboard({ jobs, clients, jobRequests, quotes, invoices, onNavigate }: { jobs: Job[]; clients: Client[]; jobRequests: JobRequest[]; quotes: Quote[]; invoices: Invoice[]; onNavigate: (route: ConsoleRoute) => void }) {
  const upcoming = jobs.find((job) => job.status !== "completed");
  const upcomingDate = upcoming ? new Date(`${upcoming.date} 00:00:00`) : null;
  const openRequests = jobRequests.filter((request) => !["Closed", "Rejected"].includes(request.status));
  const quotesAwaiting = quotes.filter((quote) => ["Draft", "Sent"].includes(quote.status));
  const unpaidTotal = invoices
    .filter((record) => !["Paid", "Void"].includes(record.paymentStatus))
    .reduce((sum, record) => sum + quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total, 0);
  const paidTotal = invoices
    .filter((record) => record.paymentStatus === "Paid")
    .reduce((sum, record) => sum + quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total, 0);
  const metrics = [
    { label: "Clients", value: String(clients.length), note: `${clients.filter((client) => client.status === "Lead").length} lead`, icon: Users, tone: "forest" },
    { label: "Open job requests", value: String(openRequests.length), note: `${openRequests.filter((request) => request.status === "Scheduled").length} scheduled`, icon: ClipboardList, tone: "olive" },
    { label: "Quotes awaiting", value: String(quotesAwaiting.length), note: `${quotes.filter((quote) => quote.status === "Accepted").length} accepted`, icon: ReceiptText, tone: "amber" },
    { label: "Unpaid invoices", value: money(unpaidTotal), note: `${money(paidTotal)} paid to date`, icon: DollarSign, tone: "red" },
  ];
  return (
    <>
      <PageHeader eyebrow="Overview" title="Dashboard">
        <span className="live-label">Live · 05/08/2026, 6:04 PM</span>
      </PageHeader>
      <section className="metric-grid" aria-label="Business metrics">
        {metrics.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div>
              <p className="eyebrow">{label}</p>
              <strong>{value}</strong>
              <span>{note}</span>
            </div>
            <div className={`metric-icon metric-icon--${tone}`}>
              <Icon aria-hidden="true" size={26} />
            </div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2>Scheduled Jobs</h2>
            </div>
            <button className="text-link" onClick={() => onNavigate("schedule")}>
              Open schedule <ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
          {upcoming ? (
            <button className="upcoming-job" onClick={() => onNavigate("jobs")}>
              <span className="date-tile"><small>{upcomingDate && !Number.isNaN(upcomingDate.getTime()) ? new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(upcomingDate) : "Job"}</small><strong>{upcomingDate && !Number.isNaN(upcomingDate.getTime()) ? upcomingDate.getDate() : "—"}</strong></span>
              <span className="upcoming-job__details">
                <strong>{upcoming.client}</strong>
                <small>{upcoming.category} · {upcoming.address}</small>
              </span>
              <Badge tone="neutral">{upcoming.status.replace("-", " ")}</Badge>
            </button>
          ) : (
            <EmptyState title="No scheduled jobs" action="Schedule a job" onAction={() => onNavigate("schedule")} />
          )}
        </article>
        <article className="panel ops-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ops pulse</p>
              <h2>Right now</h2>
            </div>
          </div>
          {([
            [TrendingUp, "Jobs in progress", jobs.filter((job) => job.status === "in-progress").length],
            [Clock3, "Site visits due", 0],
            [ReceiptText, "Quotes to send", quotes.filter((quote) => quote.status === "Draft").length],
            [DollarSign, "Invoices overdue", 0],
          ] satisfies Array<[LucideIcon, string, number]>).map(([Icon, label, count]) => (
            <div className="ops-row" key={label}>
              <span><Icon aria-hidden="true" size={18} /> {label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}

function EmptyState({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <FileCheck2 aria-hidden="true" size={28} />
      <p>{title}</p>
      {action ? <button onClick={onAction}>{action} <ArrowRight aria-hidden="true" size={15} /></button> : null}
    </div>
  );
}

function matchesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function Clients({ clients, onEdit, onCreate, onDelete, canManage, archiveMode }: { clients: Client[]; onEdit: (client: Client) => void; onCreate: () => void; onDelete: (client: Client) => void; canManage: boolean; archiveMode: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Client["status"]>("All");
  const [preferred, setPreferred] = useState<"All" | Client["preferred"]>("All");
  const visible = clients.filter((client) => {
    const searchable = [
      client.name,
      client.phone,
      client.email,
      client.notes,
      ...client.properties.flatMap((property) => [property.name, property.address, property.cadence]),
    ].join(" ");
    return matchesText(searchable, query)
      && (status === "All" || client.status === status)
      && (preferred === "All" || client.preferred === preferred);
  });
  return (
    <>
      <PageHeader eyebrow="Directory" title="Clients" subtitle="Each client can have multiple properties.">
        {canManage ? <Button icon={Plus} onClick={onCreate}>New Client</Button> : null}
      </PageHeader>
      <section className="list-filters" aria-label="Client filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search clients</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
        </label>
        <div className="filter-controls">
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select"><span className="sr-only">Client status</span><select value={status} onChange={(event) => setStatus(event.target.value as "All" | Client["status"])}><option value="All">All statuses</option><option>Lead</option><option>Active</option><option>Inactive</option></select><ChevronDown aria-hidden="true" size={16} /></label>
          <label className="compact-select"><span className="sr-only">Preferred contact</span><select value={preferred} onChange={(event) => setPreferred(event.target.value as "All" | Client["preferred"])}><option value="All">All contact methods</option><option>Email</option><option>Phone</option><option>SMS</option></select><ChevronDown aria-hidden="true" size={16} /></label>
        </div>
      </section>
      {visible.length ? (
        <section className="client-grid">
          {visible.map((client) => (
            <article className="client-card" key={client.id}>
              <div className="card-heading">
                <div className="title-with-badge">
                  <h2>{client.name}</h2>
                  <Badge>{client.status}</Badge>
                </div>
                {canManage ? (
                  <div className="inline-actions">
                    <IconButton label={`Edit ${client.name}`} icon={Pencil} onClick={() => onEdit(client)} />
                    <IconButton label={`${archiveMode ? "Archive" : "Delete"} ${client.name}`} icon={Trash2} tone="danger" onClick={() => onDelete(client)} />
                  </div>
                ) : null}
              </div>
              <div className="contact-row">
                <span><Phone aria-hidden="true" size={16} /> {client.phone}</span>
                <span><Mail aria-hidden="true" size={16} /> {client.email}</span>
              </div>
              <div className="property-list">
                {client.properties.map((property) => (
                  <div key={property.id || `${property.name}-${property.address}`}>
                    <MapPin aria-hidden="true" size={16} />
                    <strong>{property.name}</strong>
                    <span>· {property.address}</span>
                  </div>
                ))}
              </div>
              {client.notes ? <p className="client-note">{client.notes}</p> : null}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No clients match the current filters." />
      )}
    </>
  );
}

function Questionnaires({ items, submissions, onSend, onPreview }: { items: Questionnaire[]; submissions: QuestionnaireSubmission[]; onSend: () => void; onPreview: (questionnaire: Questionnaire) => void }) {
  return (
    <>
      <PageHeader eyebrow="Client intake" title="Assessment Questionnaires" subtitle="Standard clean, bond clean, yard and maintenance - send a fillable form.">
        <Button icon={Send} onClick={onSend}>Send Questionnaire</Button>
      </PageHeader>
      <section className="questionnaire-grid">
        {items.map((item) => (
          <button className="questionnaire-card" key={item.id} onClick={() => onPreview(item)}>
            <Badge tone={item.tone}>{item.category}</Badge>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <span className="question-count">{item.count} questions</span>
            <span className="card-link">Preview form <ArrowUpRight aria-hidden="true" size={15} /></span>
          </button>
        ))}
      </section>
      <section className="submissions-section">
        <h2>Submissions</h2>
        {submissions.length ? <div className="submission-list">{submissions.map((submission) => <article key={submission.id}><div><strong>{submission.respondent}</strong><span>{submission.email || "No email supplied"}</span></div><div><strong>{submission.questionnaire}</strong><span>Submitted {submission.submitted}</span></div></article>)}</div> : <EmptyState title="No submissions yet." action="Send the first questionnaire" onAction={onSend} />}
      </section>
    </>
  );
}

function Requests({ requests, onCreate, onQuote, onEstimate, onDelete, canManage }: { requests: JobRequest[]; onCreate: () => void; onQuote: (request: JobRequest) => void; onEstimate: () => void; onDelete: (request: JobRequest) => void; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | JobRequest["status"]>("All");
  const [category, setCategory] = useState<"All" | JobRequest["category"]>("All");
  const visible = requests.filter((request) => {
    const searchable = [request.client, request.address, request.category, request.scope, request.created].join(" ");
    return matchesText(searchable, query)
      && (status === "All" || request.status === status)
      && (category === "All" || request.category === category);
  });
  const categories = Array.from(new Set(requests.map((request) => request.category)));
  return (
    <>
      <PageHeader eyebrow="Intake" title="Job Requests" subtitle="Log scope, site visits and quote intent per property.">
        {canManage ? <Button icon={Plus} onClick={onCreate}>New Request</Button> : null}
      </PageHeader>
      <section className="list-filters" aria-label="Job request filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search job requests</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
        </label>
        <div className="filter-controls">
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select"><span className="sr-only">Request status</span><select value={status} onChange={(event) => setStatus(event.target.value as "All" | JobRequest["status"])}><option value="All">All statuses</option><option>New</option><option>Qualified</option><option>Quoting</option><option>Scheduled</option><option>Closed</option><option>Rejected</option></select><ChevronDown aria-hidden="true" size={16} /></label>
          <label className="compact-select compact-select--wide"><span className="sr-only">Service category</span><select value={category} onChange={(event) => setCategory(event.target.value as "All" | JobRequest["category"])}><option value="All">All service categories</option>{categories.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
        </div>
      </section>
      {visible.length ? visible.map((request) => (
        <article className="request-card" key={request.id}>
          <div className="request-card__main">
            <div className="title-with-badge request-title">
              <Badge tone="sage">{request.category}</Badge>
              <h2>{request.client}</h2>
              <Badge>{request.status}</Badge>
            </div>
            <p className="location-line"><MapPin aria-hidden="true" size={17} /> {request.address}</p>
            <p className="request-scope">{request.scope}</p>
            <p className="request-dates">
              Created {request.created}
              {request.scheduled ? ` · Scheduled ${request.scheduled}` : ""}
              {request.visit ? ` · Visit ${request.visit}` : ""}
            </p>
          </div>
          <div className="request-card__actions">
            <Button variant="secondary" icon={ReceiptText} onClick={() => onQuote(request)}>Create quote</Button>
            <button className="ai-secondary" type="button" onClick={onEstimate}><Sparkles aria-hidden="true" size={17} /> AI estimate</button>
            {canManage ? <IconButton label={`Delete request for ${request.client}`} icon={Trash2} tone="danger" onClick={() => onDelete(request)} /> : null}
          </div>
        </article>
      )) : (
        <EmptyState title={requests.length ? "No job requests match the current filters." : "No job requests yet."} action={!requests.length && canManage ? "Create the first request" : undefined} onAction={!requests.length && canManage ? onCreate : undefined} />
      )}
    </>
  );
}

function Quotes({ quotes, onNew, onView, onEstimate, onDelete }: { quotes: Quote[]; onNew: () => void; onView: (quote: Quote) => void; onEstimate: () => void; onDelete: (quote: Quote) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Quote["status"]>("All");
  const visible = quotes.filter((quote) => {
    const searchable = [quote.id, quote.documentNumber, quote.client, quote.address, quote.issued, quote.expires, quote.scope, quote.clientNotes].join(" ");
    return matchesText(searchable, query) && (status === "All" || quote.status === status);
  });
  return (
    <>
      <PageHeader eyebrow="Pricing" title="Quotes" subtitle="14-day validity · No GST applied.">
        <Button variant="secondary" icon={Sparkles} onClick={onEstimate}>AI Estimator</Button>
        <Button icon={Plus} onClick={onNew}>New Quote</Button>
      </PageHeader>
      <section className="list-filters" aria-label="Quote filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search quotes</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
        </label>
        <div className="filter-controls"><span className="filter-controls__label">Filter by</span><label className="compact-select" aria-label="Quote status filter"><span className="sr-only">Quote status</span><select value={status} onChange={(event) => setStatus(event.target.value as "All" | Quote["status"])}><option value="All">All statuses</option><option>Draft</option><option>Sent</option><option>Accepted</option><option>Declined</option></select><ChevronDown aria-hidden="true" size={16} /></label></div>
      </section>
      <section className="record-list">
        {visible.map((quote) => {
          const totals = quoteTotals(quote.items);
          return (
            <article className="record-row" key={quote.id}>
              <div>
                <div className="title-with-badge"><h2>{quote.documentNumber || quote.id}</h2><Badge tone={quoteStatusTone(quote.status)}>{quote.status}</Badge></div>
                <strong className="record-client">{quote.client}</strong>
                <p>{quote.address} · Issued {quote.issued} · Expires {quote.expires}</p>
              </div>
              <div className="record-row__actions">
                <div className="amount-block"><strong>{money(totals.total)}</strong><small>NO GST</small></div>
                <Button variant="secondary" icon={Eye} onClick={() => onView(quote)}>View</Button>
                <IconButton label={`Delete ${quote.documentNumber || quote.id}`} icon={Trash2} tone="danger" onClick={() => onDelete(quote)} />
              </div>
            </article>
          );
        })}
        {!visible.length ? <EmptyState title="No quotes match the current filters." /> : null}
      </section>
    </>
  );
}

function Schedule({ jobs, onSchedule, onJob }: { jobs: Job[]; onSchedule: () => void; onJob: (job: Job) => void }) {
  const [month, setMonth] = useState(() => new Date(2026, 7, 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(month);
  const visibleJobs = jobs.filter((job) => job.dateKey.startsWith(monthPrefix));
  const jobsByDay = new Map<number, Job[]>();
  for (const job of visibleJobs) {
    const day = Number(job.dateKey.slice(8, 10));
    jobsByDay.set(day, [...(jobsByDay.get(day) || []), job]);
  }
  jobsByDay.forEach((dayJobs) => dayJobs.sort((a, b) => a.dateKey.localeCompare(b.dateKey)));
  const selectedJobs = selectedDateKey ? jobs.filter((job) => job.dateKey.startsWith(selectedDateKey)).sort((a, b) => a.dateKey.localeCompare(b.dateKey)) : [];
  const selectedDayLabel = selectedDateKey ? new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" }).format(new Date(`${selectedDateKey}T00:00:00+10:00`)) : "";
  return (
    <>
      <PageHeader eyebrow="Calendar" title="Schedule">
        <div className="month-switcher"><IconButton label="Previous month" icon={ArrowLeft} onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} /><strong>{monthLabel}</strong><IconButton label="Next month" icon={ArrowRight} onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} /></div>
        <Button onClick={onSchedule}>Schedule a job</Button>
      </PageHeader>
      <div className="calendar-wrap">
        <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {calendarCells.map((day, index) => {
            const dayJobs = day ? jobsByDay.get(day) || [] : [];
            const dateKey = day ? `${monthPrefix}${String(day).padStart(2, "0")}` : "";
            return (
              <div className={`calendar-day ${day ? "" : "calendar-day--empty"} ${dayJobs.length ? "calendar-day--busy" : ""}`} key={`${monthPrefix}${index}`}>
                {day ? <button className="calendar-day__open" type="button" aria-label={`Open ${day} ${monthLabel}${dayJobs.length ? `, ${dayJobs.length} jobs` : ", no jobs"}`} onClick={() => setSelectedDateKey(dateKey)}><span>{day}</span>{dayJobs.length ? <strong className="calendar-day__count">{dayJobs.length}</strong> : null}</button> : null}
                <div className="calendar-day__events">
                  {dayJobs.slice(0, 1).map((job) => <button className={`calendar-event calendar-event--${job.status}`} key={job.id} title={job.displayName} onClick={() => onJob(job)}><span>{job.time} · {job.client}</span><small>{job.property}</small></button>)}
                  {dayJobs.length > 1 ? <button className="calendar-day__more" type="button" onClick={() => setSelectedDateKey(dateKey)}>+{dayJobs.length - 1} more</button> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mobile-agenda">
        {visibleJobs.map((job) => <button key={job.id} onClick={() => onJob(job)}><span>{job.date}</span><strong>{job.displayName}</strong><small>{job.address}</small></button>)}
        {!visibleJobs.length ? <div className="empty-state"><p>No jobs scheduled for {monthLabel}.</p></div> : null}
      </div>
      {selectedDateKey ? <Dialog title={selectedDayLabel} onClose={() => setSelectedDateKey(null)} wide><div className="day-agenda"><div className="day-agenda__header"><div><p className="eyebrow">Daily schedule</p><strong>{selectedJobs.length} job{selectedJobs.length === 1 ? "" : "s"}</strong></div><Button icon={Plus} onClick={() => { setSelectedDateKey(null); onSchedule(); }}>Schedule another job</Button></div>{selectedJobs.length ? <div className="day-agenda__list">{selectedJobs.map((job, index) => <button type="button" key={job.id} onClick={() => { setSelectedDateKey(null); onJob(job); }}><time>{job.time || "Time TBC"}</time><span className="day-agenda__line" aria-hidden="true"><i />{index < selectedJobs.length - 1 ? <b /> : null}</span><div><strong>{job.client}</strong><span>{job.property} · {job.address}</span><small>{job.category} · {job.status.replace("-", " ")}{job.assignees.length ? ` · ${job.assignees.join(", ")}` : " · Unassigned"}</small></div><ArrowRight aria-hidden="true" size={18} /></button>)}</div> : <EmptyState title="No jobs scheduled for this day." action="Schedule a job" onAction={() => { setSelectedDateKey(null); onSchedule(); }} />}</div></Dialog> : null}
    </>
  );
}

function JobBoard({ jobs, onJob, onMove, onDelete }: { jobs: Job[]; onJob: (job: Job) => void; onMove: (id: string, status: JobStatus) => void; onDelete: (job: Job) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Execution" title="Job Board" subtitle="Track jobs from scheduled to completed. Select a card to add photos and notes." />
      <section className="job-board" aria-label="Job board">
        {statusColumns.map((column) => {
          const columnJobs = jobs.filter((job) => job.status === column.id);
          return (
            <div
              className="job-column"
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && onMove(dragging, column.id)}
            >
              <div className="job-column__header"><h2>{column.label}</h2><Badge>{columnJobs.length}</Badge></div>
              {columnJobs.map((job) => (
                <article
                  className="job-card"
                  key={job.id}
                  draggable
                  onDragStart={() => setDragging(job.id)}
                  onDragEnd={() => setDragging(null)}
                >
                  <button className="job-card__open" type="button" onClick={() => onJob(job)}>
                    <span className="drag-handle"><GripVertical aria-hidden="true" size={15} /></span>
                    <Badge tone="sage">{job.category}</Badge>
                    <strong>{job.displayName}</strong>
                    <p>{job.scope}</p>
                    <small>{job.assignees.length ? job.assignees.join(", ") : "Unassigned"}</small>
                  </button>
                  <IconButton className="job-card__delete" label={`Delete job for ${job.client} on ${job.date}`} icon={Trash2} tone="danger" onClick={() => onDelete(job)} />
                </article>
              ))}
              {!columnJobs.length ? <div className="job-column__empty">Drop or move a job here</div> : null}
            </div>
          );
        })}
      </section>
    </>
  );
}

function Invoices({ records, onNew, onView, onPaymentStatusChange, onDelete }: { records: Invoice[]; onNew: () => void; onView: (record: Invoice) => void; onPaymentStatusChange: (invoiceId: string, status: Invoice["paymentStatus"]) => void; onDelete: (record: Invoice) => void }) {
  const [query, setQuery] = useState("");
  const [documentStatus, setDocumentStatus] = useState<"All" | Invoice["documentStatus"]>("All");
  const [paymentStatus, setPaymentStatus] = useState<"All" | Invoice["paymentStatus"]>("All");
  const visible = records.filter((record) => {
    const searchable = [
      record.id,
      record.documentNumber,
      record.client,
      record.address,
      record.issued,
      record.due,
      record.notes,
      ...(record.scope || []),
      ...record.items.map((item) => item.description),
    ].join(" ");
    return matchesText(searchable, query)
      && (documentStatus === "All" || record.documentStatus === documentStatus)
      && (paymentStatus === "All" || record.paymentStatus === paymentStatus);
  });
  const outstanding = records
    .filter((record) => !["Paid", "Void"].includes(record.paymentStatus))
    .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  const paid = records
    .filter((record) => record.paymentStatus === "Paid")
    .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  return (
    <>
      <PageHeader eyebrow="Billing" title="Invoices" subtitle="Due upon completion · 7-day grace period · No GST.">
        <div className="billing-summary"><span>Outstanding: <strong>{money(outstanding)}</strong></span><span>Paid: <strong className="success-text">{money(paid)}</strong></span></div>
        <Button icon={Plus} onClick={onNew}>Create Invoice</Button>
      </PageHeader>
      <section className="list-filters" aria-label="Invoice filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search invoices</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
        </label>
        <div className="filter-controls">
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select"><span className="sr-only">Invoice document status</span><select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value as "All" | Invoice["documentStatus"])}><option value="All">All document statuses</option><option>Draft</option><option>Finalized</option><option>Void</option></select><ChevronDown aria-hidden="true" size={16} /></label>
          <label className="compact-select"><span className="sr-only">Invoice payment status</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "All" | Invoice["paymentStatus"])}><option value="All">All payment statuses</option><option>Unpaid</option><option>Part paid</option><option>Paid</option><option>Void</option></select><ChevronDown aria-hidden="true" size={16} /></label>
        </div>
      </section>
      <section className="record-list">
        {visible.map((record) => {
          const totals = quoteTotals(record.items);
          return (
            <article className="record-row" key={record.id}>
              <div>
                <div className="title-with-badge"><h2>{record.documentNumber || record.id}</h2><Badge>{record.documentStatus}</Badge><Badge tone={paymentStatusTone(record.paymentStatus)}>{record.paymentStatus}</Badge></div>
                <strong className="record-client">{record.client}</strong>
                <p>{record.address} · Issued {record.issued} · Due {record.due}</p>
              </div>
              <div className="record-row__actions">
                <div className="amount-block"><strong>{money(totals.total)}</strong><small>NO GST</small></div>
                <label className="compact-select"><span className="sr-only">Payment status for {record.documentNumber || record.id}</span><select aria-label={`Payment status for ${record.documentNumber || record.id}`} value={record.paymentStatus} onChange={(event) => onPaymentStatusChange(record.id, event.target.value as Invoice["paymentStatus"])}><option>Unpaid</option><option>Part paid</option><option>Paid</option><option>Void</option></select><ChevronDown aria-hidden="true" size={16} /></label>
                <Button variant="secondary" icon={Eye} onClick={() => onView(record)}>View</Button>
                <IconButton label={`Delete ${record.documentNumber || record.id}`} icon={Trash2} tone="danger" onClick={() => onDelete(record)} />
              </div>
            </article>
          );
        })}
        {!visible.length ? <EmptyState title="No invoices match the current filters." /> : null}
      </section>
    </>
  );
}

function ClientForm({ client, onClose, onSave, pending = false, error = "" }: { client?: Client; onClose: () => void; onSave: (client: Client) => void | Promise<void>; pending?: boolean; error?: string }) {
  const [name, setName] = useState(client?.name || "");
  const [status, setStatus] = useState(client?.status || "Lead");
  const [phone, setPhone] = useState(client?.phone || "");
  const [email, setEmail] = useState(client?.email || "");
  const [preferred, setPreferred] = useState(client?.preferred || "Email");
  const [notes, setNotes] = useState(client?.notes || "");
  const [properties, setProperties] = useState(client?.properties || [{ name: "", address: "", cadence: "One-off" }]);

  const updateProperty = (index: number, key: keyof Property, value: string) => setProperties((current) => current.map((property, itemIndex) => itemIndex === index ? { ...property, [key]: value } : property));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    void onSave({ ...(client || {}), id: client?.id || `client-${Date.now()}`, name, status, phone, email, preferred, notes, properties });
  };
  return (
    <form onSubmit={submit} className="form-stack" aria-busy={pending}>
      <div className="form-grid form-grid--two">
        <Field label="Name" required><input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value as Client["status"])}><option>Lead</option><option>Active</option><option>Inactive</option></select></Field>
        <Field label="Phone"><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="Email" required><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
        <Field label="Preferred contact" className="field--span-two"><select value={preferred} onChange={(event) => setPreferred(event.target.value as Client["preferred"])}><option>Email</option><option>Phone</option><option>SMS</option></select></Field>
      </div>
      <section className="nested-section">
        <div className="nested-section__header"><h3>Properties / Addresses</h3><Button variant="secondary" icon={Plus} type="button" onClick={() => setProperties((current) => [...current, { name: "", address: "", cadence: "One-off" }])}>Add property</Button></div>
        <div className="property-editor-labels"><span>Property name</span><span>Street address</span><span>Cadence</span><span></span></div>
        {properties.map((property, index) => (
          <div className="property-editor" key={property.id || `new-property-${index}`}>
            <input aria-label={`Property ${index + 1} name`} value={property.name} onChange={(event) => updateProperty(index, "name", event.target.value)} placeholder="Property name" />
            <input aria-label={`Property ${index + 1} address`} value={property.address} onChange={(event) => updateProperty(index, "address", event.target.value)} placeholder="Street address" />
            <select aria-label={`Property ${index + 1} cadence`} value={property.cadence} onChange={(event) => updateProperty(index, "cadence", event.target.value)}>
              <option value="One-off">One-off</option>
              <option value="Weekly">Weekly</option>
              <option value="Fortnightly">Fortnightly</option>
              <option value="Four-weekly">Four-weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Every Tuesday">Every Tuesday</option>
            </select>
            <IconButton label={`Remove property ${index + 1}`} icon={Trash2} tone="danger" type="button" onClick={() => setProperties((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
          </div>
        ))}
      </section>
      <Field label="Notes"><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button icon={Save} type="submit" disabled={pending}>{pending ? "Saving…" : "Save Client"}</Button></div>
    </form>
  );
}

function LineItemEditor({ items, setItems }: { items: LineItem[]; setItems: Dispatch<SetStateAction<LineItem[]>> }) {
  const update = (index: number, key: keyof LineItem, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return (
    <section className="line-items-section">
      <div className="nested-section__header"><h3>Line Items <span aria-hidden="true">*</span></h3><Button variant="secondary" icon={Plus} type="button" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, rate: 0 }])}>Add item</Button></div>
      <div className="line-item-labels"><span>Description</span><span>Qty / hours</span><span>Unit price</span><span>Line total</span><span></span></div>
      {items.map((item, index) => (
        <div className="line-item-row" key={index}>
          <input aria-label={`Item ${index + 1} description`} value={item.description} onChange={(event) => update(index, "description", event.target.value)} placeholder="Description" required />
          <input aria-label={`Item ${index + 1} quantity`} type="number" min="0" step="0.25" value={item.quantity} onChange={(event) => update(index, "quantity", event.target.value)} required />
          <input aria-label={`Item ${index + 1} unit price`} type="number" min="0" step="0.01" value={item.rate} onChange={(event) => update(index, "rate", event.target.value)} required />
          <output aria-label={`Item ${index + 1} total`}>{money(Number(item.quantity || 0) * Number(item.rate || 0))}</output>
          <IconButton label={`Remove line item ${index + 1}`} icon={Trash2} tone="danger" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
        </div>
      ))}
    </section>
  );
}

function Totals({ items }: { items: LineItem[] }) {
  const totals = quoteTotals(items);
  return (
    <div className="totals-block"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>Tax rate</span><strong>0.00%</strong></div><div className="totals-block__total"><span>Total</span><strong>{money(totals.total)}</strong></div></div>
  );
}

function QuoteForm({ requests, onClose, onSave, pending = false, error = "" }: { requests: JobRequest[]; onClose: () => void; onSave: (draft: QuoteDraft) => void | Promise<void>; pending?: boolean; error?: string }) {
  const [jobRequestId, setJobRequestId] = useState("");
  const [scope, setScope] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [clientNotes, setClientNotes] = useState("Please contact us if you wish to amend any items on this quote.");
  const [internalNotes, setInternalNotes] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobRequestId || !scope || items.some((item) => !item.description)) return;
    void onSave({ jobRequestId, scope, items, clientNotes, internalNotes });
  };
  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <Field label="Job request" required><select value={jobRequestId} onChange={(event) => { const selected = requests.find((request) => request.id === event.target.value); setJobRequestId(event.target.value); if (selected && !scope) setScope(selected.scope); }} required disabled={pending}><option value="">Choose...</option>{requests.map((request) => <option value={request.id} key={request.id}>{request.client} · {request.address}</option>)}</select></Field>
      <Field label="Scope summary" required><input value={scope} onChange={(event) => setScope(event.target.value)} required /></Field>
      <LineItemEditor items={items} setItems={setItems} />
      <Totals items={items} />
      <div className="form-grid form-grid--two">
        <Field label="Client notes"><textarea rows={4} value={clientNotes} onChange={(event) => setClientNotes(event.target.value)} /></Field>
        <Field label="Internal notes"><textarea rows={4} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></Field>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button icon={Save} type="submit" disabled={pending}>{pending ? "Saving…" : "Save Quote"}</Button></div>
    </form>
  );
}

function InvoiceForm({ clients, jobs, onClose, onSave, pending = false, error = "" }: { clients: Client[]; jobs: Job[]; onClose: () => void; onSave: (draft: InvoiceDraft) => void | Promise<void>; pending?: boolean; error?: string }) {
  const [clientId, setClientId] = useState("");
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState("");
  const [jobId, setJobId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [dueDays, setDueDays] = useState("7");
  const [notes, setNotes] = useState("Invoices are due upon completion with a 7-day grace period.");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientId || !propertyId || items.some((item) => !item.description)) return;
    void onSave({ clientId, propertyId, jobId: jobId || undefined, items, dueDays, notes });
  };
  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <div className="form-grid form-grid--two">
        <Field label="Client" required><select value={clientId} onChange={(event) => { const next = clients.find((client) => client.id === event.target.value); setClientId(event.target.value); setPropertyId(next?.properties[0]?.id || ""); }} required disabled={pending}><option value="">Choose...</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></Field>
        <Field label="Prefill from job"><select value={jobId} onChange={(event) => { const next = jobs.find((job) => job.id === event.target.value); setJobId(event.target.value); if (next) { const client = clients.find((item) => item.name === next.client); setClientId(client?.id || ""); setPropertyId(client?.properties.find((property) => property.address === next.address)?.id || ""); } }} disabled={pending}><option value="">Start blank</option>{jobs.map((job) => <option value={job.id} key={job.id}>{job.displayName} · {job.category}</option>)}</select></Field>
      </div>
      <Field label="Address / Property" required><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required disabled={pending || !selectedClient}><option value="">Choose...</option>{(selectedClient?.properties || []).map((property, index) => <option value={property.id || `${clientId}-property-${index}`} key={property.id || property.address}>{property.address}</option>)}</select></Field>
      <LineItemEditor items={items} setItems={setItems} />
      <Totals items={items} />
      <div className="form-grid form-grid--three">
        <Field label="Payment due"><input value="Upon completion" readOnly /></Field>
        <Field label="Grace period (days)"><input type="number" min="0" value={dueDays} onChange={(event) => setDueDays(event.target.value)} /></Field>
        <Field label="Tax rate"><input value="0.00%" readOnly /></Field>
      </div>
      <Field label="Notes to client"><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button icon={Save} type="submit" disabled={pending}>{pending ? "Saving…" : "Save Invoice"}</Button></div>
    </form>
  );
}

function SendQuestionnaire({ items, onClose, onSend }: { items: Questionnaire[]; onClose: () => void; onSend?: SendQuestionnaireAction }) {
  const [template, setTemplate] = useState(items[0]?.id || "");
  const [recipient, setRecipient] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [share, setShare] = useState<{ url: string; recipient: string; email: string } | null>(null);
  if (share) {
    const subject = encodeURIComponent("Your property service questionnaire");
    const body = encodeURIComponent(`Hi ${share.recipient},\n\nPlease complete this secure questionnaire:\n${share.url}\n\nThis link is valid for 30 days and can be submitted once.`);
    return <div className="form-stack"><div className="link-preview"><FileCheck2 aria-hidden="true" size={20} /><div><strong>Secure link ready</strong><span>{share.url}</span></div></div><div className="dialog-actions"><Button variant="secondary" type="button" onClick={() => void navigator.clipboard.writeText(share.url)}>Copy link</Button><a className="button button--primary" href={`mailto:${encodeURIComponent(share.email)}?subject=${subject}&body=${body}`}><Mail aria-hidden="true" size={18} /><span>Open email</span></a><Button variant="secondary" type="button" onClick={onClose}>Done</Button></div></div>;
  }
  return (
    <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setError(""); if (!onSend) { setError("Live questionnaire sharing is not available."); return; } setPending(true); const result = await onSend({ questionnaireId: template, recipient, email }); setPending(false); if (!result.ok) { setError(result.message); return; } setShare({ ...result, url: `${window.location.origin}${result.path}` }); }}>
      <Field label="Template" required><select value={template} onChange={(event) => setTemplate(event.target.value)} disabled={pending}>{items.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
      <div className="form-grid form-grid--two">
        <Field label="Recipient name" required><input value={recipient} onChange={(event) => setRecipient(event.target.value)} required disabled={pending} /></Field>
        <Field label="Recipient email" required><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={pending} /></Field>
      </div>
      <div className="link-preview"><FileText aria-hidden="true" size={20} /><div><strong>Secure public link</strong><span>Valid for 30 days · One submission</span></div></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button icon={Send} type="submit" disabled={pending || !items.length}>{pending ? "Creating…" : "Create secure link"}</Button></div>
    </form>
  );
}

function RequestForm({ clients, onClose, onSave, pending = false, error = "" }: { clients: Client[]; onClose: () => void; onSave: (draft: JobRequestDraft) => void | Promise<void>; pending?: boolean; error?: string }) {
  const [clientId, setClientId] = useState("");
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState<JobRequestDraft["category"]>("Standard / General Clean");
  const [scope, setScope] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientId || !propertyId || !scope) return;
    void onSave({ clientId, propertyId, category, scope });
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <Field label="Client" required>
        <select value={clientId} onChange={(event) => {
          const nextClientId = event.target.value;
          const nextClient = clients.find((client) => client.id === nextClientId);
          setClientId(nextClientId);
          setPropertyId(nextClient?.properties[0]?.id || "");
        }} required disabled={pending}>
          <option value="">Choose...</option>
          {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
        </select>
      </Field>
      <Field label="Property" required>
        <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required disabled={pending || !selectedClient}>
          <option value="">Choose...</option>
          {(selectedClient?.properties || []).map((property, index) => (
            <option value={property.id || `${clientId}-property-${index}`} key={property.id || `${property.name}-${property.address}`}>
              {property.address}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Service category" required>
        <select value={category} onChange={(event) => setCategory(event.target.value as JobRequestDraft["category"])} required disabled={pending}>
          <option value="Standard / General Clean">Standard / General Clean</option>
          <option value="Bond Clean / End of Lease">Bond Clean / End of Lease</option>
          <option value="Yard Cleanup">Yard Cleanup</option>
          <option value="Property Maintenance">Property Maintenance</option>
        </select>
      </Field>
      <Field label="Scope summary" required><textarea rows={4} value={scope} onChange={(event) => setScope(event.target.value)} required disabled={pending} /></Field>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" icon={Save} disabled={pending}>{pending ? "Saving..." : "Save Request"}</Button></div>
    </form>
  );
}

function PublicQuestionnaire({ questionnaire, onClose }: { questionnaire: Questionnaire; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  if (submitted) {
    return <div className="public-form-page"><div className="public-form-success"><CheckCircle2 aria-hidden="true" size={44} /><p className="eyebrow">FieldCentral Pro</p><h1>Responses received</h1><p>Thanks - the team can now prepare an accurate quote.</p><Button onClick={onClose}>Close preview</Button></div></div>;
  }
  return (
    <div className="public-form-page">
      <form className="public-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
        <div className="public-form__header"><p className="eyebrow">FieldCentral Pro</p><h1>{questionnaire?.title || "Bond Clean / End of Lease Questionnaire"}</h1><p>Please answer the questions below so we can prepare an accurate quote.</p><button type="button" onClick={onClose}>Exit preview</button></div>
        <div className="progress-row"><span>Step 1 of 1</span><div><i /></div></div>
        <fieldset><legend>1. Property type & bedrooms/bathrooms <span>*</span></legend>{["1 Bed / 1 Bath Unit", "2 Bed / 2 Bath Unit", "3 Bed / 2 Bath House", "4+ Bed Home"].map((option) => <label key={option}><input name="property" type="radio" required /> {option}</label>)}</fieldset>
        <fieldset><legend>2. Carpet steam clean required? <span>*</span></legend>{["Yes - all rooms", "Yes - bedrooms only", "No carpets", "Unsure"].map((option) => <label key={option}><input name="carpet" type="radio" required /> {option}</label>)}</fieldset>
        <fieldset><legend>3. Oven & rangehood condition <span>*</span></legend>{["Standard", "Heavy grease", "Double oven heavy"].map((option) => <label key={option}><input name="oven" type="radio" required /> {option}</label>)}</fieldset>
        <fieldset><legend>4. Window cleaning scope</legend>{["Inside glass & tracks", "Outside ground level", "Outside high level", "Flyscreens & sills"].map((option) => <label key={option}><input type="checkbox" /> {option}</label>)}</fieldset>
        <Field label="5. Special stains, wall scuffs or pest treatment?"><textarea rows={4} /></Field>
        <p className="privacy-note">Your responses are used only to prepare this service estimate.</p>
        <Button type="submit">Submit responses</Button>
      </form>
    </div>
  );
}

function ScheduleForm({ requests, onClose, onSchedule, pending = false, error = "" }: { requests: JobRequest[]; onClose: () => void; onSchedule: (payload: { jobRequestId: string; scheduledStart: string }) => void | Promise<void>; pending?: boolean; error?: string }) {
  const [request, setRequest] = useState("");
  const [date, setDate] = useState("2026-08-11T09:00");
  return (
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSchedule({ jobRequestId: request, scheduledStart: new Date(`${date}:00+10:00`).toISOString() }); }} aria-busy={pending}>
      <Field label="Job request" required><select value={request} onChange={(event) => setRequest(event.target.value)} required disabled={pending}><option value="">Choose...</option>{requests.map((item) => <option value={item.id} key={item.id}>{item.client} · {item.category}</option>)}</select></Field>
      <Field label="Date & time" required><input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required disabled={pending} /></Field>
      <div className="conflict-note"><Check aria-hidden="true" size={17} /> No schedule conflicts detected.</div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Scheduling…" : "Schedule"}</Button></div>
    </form>
  );
}

function JobDetails({ job, teamMembers, onClose, onUpdate, onAssign, onUploadPhoto, onDeletePhoto, onDelete, pending, error }: { job: Job; teamMembers: TeamMember[]; onClose: () => void; onUpdate: (job: Job) => void; onAssign: (profileIds: string[]) => void; onUploadPhoto: (file: File) => void; onDeletePhoto: (photo: JobPhoto) => void; onDelete: (job: Job) => void; pending: boolean; error: string }) {
  const [notes, setNotes] = useState(job.notes || "");
  const [recurrence, setRecurrence] = useState(job.recurrence || "One-off");
  const [assigneeIds, setAssigneeIds] = useState(job.assigneeIds || []);
  const updateStatus = (status: JobStatus) => onUpdate({ ...job, status, notes, recurrence });
  const toggleAssignee = (profileId: string) => { const next = assigneeIds.includes(profileId) ? assigneeIds.filter((id) => id !== profileId) : [...assigneeIds, profileId]; setAssigneeIds(next); onAssign(next); };
  return (
    <div className="job-detail">
      <div className="job-facts"><div><p className="eyebrow">Address</p><span>{job.address}</span></div><div><p className="eyebrow">Scheduled</p><span>{job.date}</span></div><div className="job-facts__scope"><p className="eyebrow">Scope</p><span>{job.scope}</span></div></div>
      <div className="status-actions"><Button icon={PlayCircle} onClick={() => updateStatus("in-progress")}>Start</Button><Button variant="secondary" icon={PauseCircle} onClick={() => updateStatus("on-hold")}>Hold</Button><Button variant="success" icon={CheckCircle2} onClick={() => updateStatus("completed")}>Complete</Button></div>
      <Field label="On-site notes"><textarea rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={() => onUpdate({ ...job, notes, recurrence })} /></Field>
      <section className="assignment-section"><div><p className="eyebrow">Assigned team</p><span>{assigneeIds.length ? `${assigneeIds.length} team member${assigneeIds.length === 1 ? "" : "s"}` : "Unassigned"}</span></div><div className="assignment-options">{teamMembers.map((member) => <label key={member.id}><input type="checkbox" checked={assigneeIds.includes(member.id)} onChange={() => toggleAssignee(member.id)} disabled={pending} /><span><strong>{member.name}</strong><small>{member.role}{member.email ? ` · ${member.email}` : ""}</small></span></label>)}</div></section>
      <div className="recurrence-row"><RotateCcw aria-hidden="true" size={18} /><Field label="Recurring"><select value={recurrence} onChange={(event) => { setRecurrence(event.target.value); onUpdate({ ...job, notes, recurrence: event.target.value }); }}><option>One-off</option><option>Weekly</option><option>Fortnightly</option><option>Four-weekly</option><option>Monthly</option></select></Field><p>Next job is created when this one is completed.</p></div>
      <div className="photo-section"><div><p className="eyebrow">Photos</p><em>{job.photos.length ? `${job.photos.length} uploaded` : "No photos yet."}</em></div><label className="photo-upload"><Camera aria-hidden="true" size={19} /> {pending ? "Uploading…" : "Add photo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={pending} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadPhoto(file); event.target.value = ""; }} /></label></div>
      {job.photos.length ? <div className="photo-grid">{job.photos.map((photo) => <article key={photo.id}><a href={photo.url} target="_blank" rel="noreferrer"><Image src={photo.url} alt={photo.caption || photo.name} width={220} height={150} unoptimized /></a><div><span>{photo.caption || photo.name}</span><IconButton label={`Delete ${photo.name}`} icon={Trash2} tone="danger" onClick={() => onDeletePhoto(photo)} disabled={pending} /></div></article>)}</div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions dialog-actions--split"><Button variant="danger" icon={Trash2} onClick={() => onDelete(job)}>Delete job</Button><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </div>
  );
}

function documentNumber(id: string) {
  return id.split("-").at(-1) ?? id;
}

function documentDate(value: string) {
  const parsed = new Date(`${value} 00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function plainAmount(value: number) {
  return new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function AccountingAmount({ value, dashForZero = false }: { value: number; dashForZero?: boolean }) {
  return <span className="accounting-amount"><span>$</span><span>{dashForZero && value === 0 ? "-" : plainAmount(value)}</span></span>;
}

function DocumentView({ type, record, onClose, onStatusChange, onFinalize }: { type: "quote" | "invoice"; record: Quote | Invoice; onClose: () => void; onStatusChange?: (status: string) => void; onFinalize?: () => void }) {
  const isQuote = "expires" in record;
  if ((type === "quote") !== isQuote) return null;
  const totals = quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0);
  const documentLabel = isQuote ? "Quote" : "Invoice";
  const status = isQuote ? record.status : record.paymentStatus;
  const scope = isQuote ? [record.scope] : (record.scope?.length ? record.scope : record.items.map((item) => item.description));
  const targetRows = isQuote ? 7 : 6;
  const blankRows = Math.max(0, targetRows - record.items.length);
  const printDocument = () => {
    const previousTitle = document.title;
    const filename = `${record.id} - ${record.client}`.replace(/[\\/:*?"<>|]+/g, "-");
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    document.title = filename;
    window.addEventListener("afterprint", restoreTitle);
    window.print();
  };

  return (
    <div className="document-view">
      <article className={`document-sheet document-sheet--${type}`} data-document-kind={type} aria-label={`${documentLabel} ${record.id}`}>
        <header className="document-letterhead">
          <div className="document-business">
            <h3>{businessProfile.name}</h3>
            <p><strong>ABN:</strong> {businessProfile.abn}</p>
            <p>{businessProfile.email}</p>
            <p>{businessProfile.phone}</p>
            <p>{businessProfile.website}</p>
          </div>
          <div className="document-heading">
            <Image src="/mow-glow-logo.png" alt="Mow & Glow Property Services" width={172} height={172} priority unoptimized />
            <h2>{documentLabel.toUpperCase()}</h2>
          </div>
        </header>

        <section className="document-address-row" aria-label="Document recipient and details">
          <div className="document-address">
            <h4>ADDRESSED TO</h4>
            <strong>{record.client}</strong>
            <span>{record.address}</span>
          </div>
          <dl className="document-facts">
            <div><dt>{documentLabel} No.</dt><dd>{documentNumber(record.id)}</dd></div>
            <div><dt>{documentLabel} Date</dt><dd>{documentDate(record.issued)}</dd></div>
            <div><dt>{isQuote ? "Valid For" : "Due"}</dt><dd>{isQuote ? `${record.validDays} Days` : record.due === "Upon completion" ? record.due : documentDate(record.due)}</dd></div>
          </dl>
        </section>

        <section className={`document-scope-row${isQuote ? "" : " document-scope-row--invoice"}`}>
          <div className="document-scope">
            <h4>SCOPE OF WORK</h4>
            {scope.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            {isQuote && record.clientNotes ? <p className="document-recommendation"><strong>Recommendation:</strong> {record.clientNotes}</p> : null}
          </div>
          {!isQuote ? <div className="document-payment"><h4>PAYMENT DETAILS</h4><dl><div><dt>To:</dt><dd>{businessProfile.paymentTo}</dd></div><div><dt>BSB:</dt><dd>{businessProfile.bsb}</dd></div><div><dt>ACC:</dt><dd>{businessProfile.accountNumber}</dd></div></dl></div> : null}
        </section>

        <table className="document-table">
          <caption className="sr-only">{documentLabel} line items</caption>
          <colgroup><col /><col className="document-table__quantity" /><col className="document-table__hours" /><col className="document-table__unit" /><col className="document-table__price" /><col className="document-table__total" /></colgroup>
          <thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Hour&apos;s</th><th scope="col">Unit</th><th scope="col">Price</th><th scope="col">Total</th></tr></thead>
          <tbody>
            {record.items.map((item, index) => <tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{item.quantity}</td><td></td><td>Each</td><td><AccountingAmount value={Number(item.rate)} /></td><td><AccountingAmount value={Number(item.quantity) * Number(item.rate)} /></td></tr>)}
            {Array.from({ length: blankRows }, (_, index) => <tr className="document-table__blank" key={`blank-${index}`} aria-hidden="true"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td><AccountingAmount value={0} dashForZero /></td></tr>)}
          </tbody>
        </table>

        <section className="document-summary" aria-label="Document totals">
          <p className="document-thanks">{isQuote ? "Thank you for the opportunity to quote." : "Thank you for your business!"}</p>
          <dl className="document-totals">
            <div><dt>SUBTOTAL</dt><dd><AccountingAmount value={totals.subtotal} /></dd></div>
            <div><dt>DISCOUNT</dt><dd><AccountingAmount value={totals.discount} dashForZero /></dd></div>
            <div><dt>TAX RATE</dt><dd>{(totals.taxRate * 100).toFixed(2)}%</dd></div>
            <div className="document-totals__grand"><dt>{documentLabel} Total</dt><dd><AccountingAmount value={totals.total} /></dd></div>
          </dl>
        </section>

        <footer className="document-note">
          <h4>{isQuote ? "Notes & Terms" : "Payment terms"}</h4>
          {!isQuote && record.notes ? <p>{record.notes}</p> : null}
          <p>{isQuote ? quoteTerms : invoiceTerms}</p>
        </footer>
      </article>

      <div className="document-actions" data-print-exclude>
        <label className="compact-select"><span className="sr-only">{isQuote ? "Quote status" : "Payment status"}</span><select value={status} onChange={(event) => onStatusChange?.(event.target.value)}>{(isQuote ? ["Draft", "Sent", "Accepted", "Declined"] : ["Unpaid", "Part paid", "Paid", "Void"]).map((option) => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" size={16} /></label>
        <div><Button variant="secondary" icon={Printer} onClick={printDocument}>Save / Print PDF</Button>{!isQuote ? <Button icon={FileCheck2} onClick={onFinalize}>Finalize</Button> : null}<Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

function ConfirmDelete({ client, onCancel, onConfirm, archiveMode, pending = false, error = "" }: { client: Client; onCancel: () => void; onConfirm: () => void | Promise<void>; archiveMode: boolean; pending?: boolean; error?: string }) {
  return <div className="confirm-delete" aria-busy={pending}><div className="warning-icon"><AlertCircle aria-hidden="true" size={24} /></div><h3>{archiveMode ? "Archive" : "Delete"} {client.name}?</h3><p>{archiveMode ? "This removes the client from active work while preserving job, quote, and invoice history." : "This prototype removes the client from local state only. Production uses recoverable archive behaviour."}</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="dialog-actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button variant="danger" icon={Trash2} onClick={() => void onConfirm()} disabled={pending}>{pending ? "Archiving…" : archiveMode ? "Archive client" : "Delete client"}</Button></div></div>;
}

function ConfirmRecordDelete({ label, kind, onCancel, onConfirm, pending = false, error = "" }: { label: string; kind: string; onCancel: () => void; onConfirm: () => void | Promise<void>; pending?: boolean; error?: string }) {
  return <div className="confirm-delete" aria-busy={pending}><div className="warning-icon"><AlertCircle aria-hidden="true" size={24} /></div><h3>Delete {label}?</h3><p>This permanently removes the {kind} from this workspace. This action cannot be undone.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="dialog-actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button variant="danger" icon={Trash2} onClick={() => void onConfirm()} disabled={pending}>{pending ? "Deleting…" : `Delete ${kind}`}</Button></div></div>;
}

function EstimatorForm({ onClose, onEstimate }: { onClose: () => void; onEstimate: () => void }) {
  return (
    <form className="estimator-form" onSubmit={(event) => { event.preventDefault(); onEstimate(); }}>
      <div className="form-grid form-grid--two">
        <Field label="Service">
          <select defaultValue="standard">
            <option value="standard">Standard / General Clean</option>
            <option value="bond">Bond Clean / End of Lease</option>
            <option value="yard">Yard Cleanup</option>
            <option value="maintenance">Property Maintenance</option>
          </select>
        </Field>
        <Field label="Address (optional)"><input /></Field>
      </div>
      <Field label="Scope description">
        <textarea rows={4} placeholder="Describe the job in plain English. e.g. Standard clean of 3-bed 2-bath. Inside oven and interior windows too." />
      </Field>
      <Button type="submit" className="estimator-submit">Estimate with Gemini 3.1 Pro</Button>
      <div className="dialog-actions"><Button type="button" variant="secondary" onClick={onClose}>Close</Button></div>
    </form>
  );
}

export function ConsoleApp({ initialClients, initialJobRequests: providedJobRequests, initialQuestionnaires: providedQuestionnaires, initialQuestionnaireSubmissions: providedQuestionnaireSubmissions, initialQuotes: providedQuotes, initialJobs: providedJobs, teamMembers = [], initialInvoices: providedInvoices, dataMode = "demo", signedInEmail = "ops@fieldcentral.local", canManageClients = true, canManageRequests = true, onSaveClient, onArchiveClient, onSaveJobRequest, onDeleteJobRequest, onSaveQuote, onUpdateQuoteStatus, onDeleteQuote, onScheduleJob, onUpdateJob, onUpdateJobAssignments, onUploadJobPhoto, onDeleteJobPhoto, onDeleteJob, onSaveInvoice, onUpdateInvoicePayment, onFinalizeInvoice, onDeleteInvoice, onSendQuestionnaire, onSignOut }: ConsoleAppProps = {}) {
  const [active, setActive] = useState<ConsoleRoute>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [clients, setClients] = useState<Client[]>(() => structuredClone(initialClients ?? clientsSeed));
  const [jobRequests, setJobRequests] = useState<JobRequest[]>(() => structuredClone(providedJobRequests ?? initialJobRequests));
  const [questionnaireItems] = useState<Questionnaire[]>(() => structuredClone(providedQuestionnaires ?? questionnaires));
  const [questionnaireSubmissions] = useState<QuestionnaireSubmission[]>(() => structuredClone(providedQuestionnaireSubmissions ?? []));
  const [quotes, setQuotes] = useState<Quote[]>(() => structuredClone(providedQuotes ?? initialQuotes));
  const [jobs, setJobs] = useState<Job[]>(() => structuredClone(providedJobs ?? initialJobs));
  const [invoiceRecords, setInvoiceRecords] = useState<Invoice[]>(() => structuredClone(providedInvoices ?? [invoice]));
  const [toast, setToast] = useState("");
  const [clientMutationPending, setClientMutationPending] = useState(false);
  const [clientMutationError, setClientMutationError] = useState("");
  const [requestMutationPending, setRequestMutationPending] = useState(false);
  const [requestMutationError, setRequestMutationError] = useState("");
  const [operationMutationPending, setOperationMutationPending] = useState(false);
  const [operationMutationError, setOperationMutationError] = useState("");

  useEffect(() => {
    if (dataMode !== "demo") return;
    const params = new URLSearchParams(window.location.search);
    const previewType = params.get("documentPreview");
    const requestedId = params.get("documentId");
    const requestedRows = Number(params.get("documentRows"));
    const previewItems = (items: LineItem[]) => {
      if (!Number.isInteger(requestedRows) || requestedRows <= items.length) return items;
      return Array.from({ length: Math.min(requestedRows, 40) }, (_, index) => {
        const source = items[index % items.length];
        return { ...source, description: `${source.description} ${index + 1}` };
      });
    };
    let previewRoute: ConsoleRoute | null = null;
    let previewDialog: DialogState | null = null;

    if (previewType === "quote") {
      const quote = initialQuotes.find((item) => item.id === requestedId) ?? initialQuotes[0];
      if (quote) {
        const preview = structuredClone(quote);
        preview.items = previewItems(preview.items);
        previewRoute = "quotes";
        previewDialog = { type: "quote-document", quote: preview };
      }
    }

    if (previewType === "invoice") {
      const preview = structuredClone(invoice);
      preview.items = previewItems(preview.items);
      previewRoute = "invoices";
      previewDialog = { type: "invoice-document", record: preview };
    }

    if (!previewRoute || !previewDialog) return;
    const nextRoute = previewRoute;
    const nextDialog = previewDialog;
    const timer = window.setTimeout(() => {
      setActive(nextRoute);
      setDialog(nextDialog);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dataMode]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };
  const closeDialog = () => {
    if (clientMutationPending || requestMutationPending || operationMutationPending) return;
    setDialog(null);
    setClientMutationError("");
    setOperationMutationError("");
  };
  const upsertClient = (saved: Client) => {
    setClients((current) => current.some((client) => client.id === saved.id) ? current.map((client) => client.id === saved.id ? saved : client) : [...current, saved]);
  };
  const persistClient = async (saved: Client) => {
    setClientMutationError("");

    if (dataMode === "demo") {
      upsertClient(saved);
      setDialog(null);
      showToast("Client saved.");
      return;
    }

    if (!onSaveClient) {
      setClientMutationError("Live client saving is not available.");
      return;
    }

    setClientMutationPending(true);
    try {
      const result = await onSaveClient(saved);
      if (!result.ok) {
        setClientMutationError(result.message);
        return;
      }
      upsertClient(result.client);
      setDialog(null);
      showToast("Client saved.");
    } catch {
      setClientMutationError("The client could not be saved. Try again.");
    } finally {
      setClientMutationPending(false);
    }
  };
  const removeClient = async (client: Client) => {
    setClientMutationError("");

    if (dataMode === "demo") {
      setClients((current) => current.filter((item) => item.id !== client.id));
      setDialog(null);
      showToast("Client deleted.");
      return;
    }

    if (!onArchiveClient) {
      setClientMutationError("Live client archiving is not available.");
      return;
    }

    setClientMutationPending(true);
    try {
      const result = await onArchiveClient(client.id);
      if (!result.ok) {
        setClientMutationError(result.message);
        return;
      }
      setClients((current) => current.filter((item) => item.id !== result.clientId));
      setDialog(null);
      showToast("Client archived.");
    } catch {
      setClientMutationError("The client could not be archived. Try again.");
    } finally {
      setClientMutationPending(false);
    }
  };
  const persistJobRequest = async (draft: JobRequestDraft) => {
    setRequestMutationError("");

    const selectedClient = clients.find((client) => client.id === draft.clientId);
    const selectedProperty = selectedClient?.properties.find((property, index) => (property.id || `${draft.clientId}-property-${index}`) === draft.propertyId);

    if (dataMode === "demo") {
      setJobRequests((current) => [{
        id: `request-${current.length + 1}`,
        clientId: selectedClient?.id,
        propertyId: selectedProperty?.id,
        client: selectedClient?.name || "Unassigned client",
        address: selectedProperty?.address || "No service address",
        category: draft.category,
        scope: draft.scope,
        status: "New",
        created: "05 Aug 2026",
      }, ...current]);
      setDialog(null);
      showToast("Job request created.");
      return;
    }

    if (!onSaveJobRequest) {
      setRequestMutationError("Live job request saving is not available.");
      return;
    }

    setRequestMutationPending(true);
    try {
      const result = await onSaveJobRequest(draft);
      if (!result.ok) {
        setRequestMutationError(result.message);
        return;
      }
      setJobRequests((current) => [result.request, ...current]);
      setDialog(null);
      showToast("Job request created.");
    } catch {
      setRequestMutationError("The job request could not be saved. Try again.");
    } finally {
      setRequestMutationPending(false);
    }
  };
  const removeJobRequest = async (request: JobRequest) => {
    setRequestMutationError("");

    if (dataMode === "demo") {
      setJobRequests((current) => current.filter((item) => item.id !== request.id));
      setDialog(null);
      showToast("Job request deleted.");
      return;
    }

    if (!onDeleteJobRequest) {
      setRequestMutationError("Live job request deletion is not available.");
      return;
    }

    setRequestMutationPending(true);
    try {
      const result = await onDeleteJobRequest(request.id);
      if (!result.ok) {
        setRequestMutationError(result.message);
        return;
      }
      setJobRequests((current) => current.filter((item) => item.id !== result.requestId));
      setDialog(null);
      showToast("Job request deleted.");
    } catch {
      setRequestMutationError("The job request could not be deleted. Try again.");
    } finally {
      setRequestMutationPending(false);
    }
  };
  const removeQuote = async (quote: Quote) => {
    if (dataMode === "live") {
      if (!onDeleteQuote) { setOperationMutationError("Live quote deletion is not available."); return; }
      setOperationMutationPending(true);
      const result = await onDeleteQuote(quote.id);
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
    }
    setQuotes((current) => current.filter((item) => item.id !== quote.id));
    setDialog(null);
    showToast("Quote deleted.");
  };
  const removeJob = async (job: Job) => {
    if (dataMode === "live") {
      if (!onDeleteJob) { setOperationMutationError("Live job deletion is not available."); return; }
      setOperationMutationPending(true);
      const result = await onDeleteJob(job.id);
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
    }
    setJobs((current) => current.filter((item) => item.id !== job.id));
    setDialog(null);
    showToast("Job deleted.");
  };
  const removeInvoice = async (record: Invoice) => {
    if (dataMode === "live") {
      if (!onDeleteInvoice) { setOperationMutationError("Live invoice deletion is not available."); return; }
      setOperationMutationPending(true);
      const result = await onDeleteInvoice(record.id);
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
    }
    setInvoiceRecords((current) => current.filter((item) => item.id !== record.id));
    setDialog(null);
    showToast("Invoice deleted.");
  };
  const updateJob = async (updated: Job) => {
    if (dataMode === "live") {
      if (!onUpdateJob) { setOperationMutationError("Live job updates are not available."); return; }
      setOperationMutationPending(true);
      const result = await onUpdateJob({ id: updated.id, status: updated.status, notes: updated.notes, recurrence: updated.recurrence as "One-off" | "Weekly" | "Fortnightly" | "Four-weekly" | "Monthly" });
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
      updated = result.job;
    }
    setJobs((current) => current.map((job) => job.id === updated.id ? updated : job));
    setDialog({ type: "job", job: updated });
    showToast(`Job moved to ${updated.status.replace("-", " ")}.`);
  };
  const assignJob = async (job: Job, profileIds: string[]) => {
    setOperationMutationError("");
    if (dataMode === "demo") {
      const updated = { ...job, assigneeIds: profileIds, assignees: profileIds.map((id) => teamMembers.find((member) => member.id === id)?.name || "Team member") };
      setJobs((current) => current.map((item) => item.id === job.id ? updated : item)); setDialog({ type: "job", job: updated }); return;
    }
    if (!onUpdateJobAssignments) { setOperationMutationError("Live job assignments are not available."); return; }
    setOperationMutationPending(true); const result = await onUpdateJobAssignments({ jobId: job.id, profileIds }); setOperationMutationPending(false);
    if (!result.ok) { setOperationMutationError(result.message); return; }
    setJobs((current) => current.map((item) => item.id === job.id ? result.job : item)); setDialog({ type: "job", job: result.job }); showToast("Job assignments saved.");
  };
  const uploadPhoto = async (job: Job, file: File) => {
    setOperationMutationError("");
    if (dataMode === "demo") { const photo: JobPhoto = { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), caption: "", created: "Today" }; const updated = { ...job, photos: [photo, ...job.photos] }; setJobs((current) => current.map((item) => item.id === job.id ? updated : item)); setDialog({ type: "job", job: updated }); return; }
    if (!onUploadJobPhoto) { setOperationMutationError("Live photo uploads are not available."); return; }
    const formData = new FormData(); formData.set("jobId", job.id); formData.set("photo", file); formData.set("caption", ""); setOperationMutationPending(true); const result = await onUploadJobPhoto(formData); setOperationMutationPending(false);
    if (!result.ok) { setOperationMutationError(result.message); return; }
    const updated = { ...job, photos: [result.photo, ...job.photos] }; setJobs((current) => current.map((item) => item.id === job.id ? updated : item)); setDialog({ type: "job", job: updated }); showToast("Job photo uploaded.");
  };
  const removePhoto = async (job: Job, photo: JobPhoto) => {
    setOperationMutationError("");
    if (dataMode === "live") { if (!onDeleteJobPhoto) { setOperationMutationError("Live photo deletion is not available."); return; } setOperationMutationPending(true); const result = await onDeleteJobPhoto(job.id, photo.id); setOperationMutationPending(false); if (!result.ok) { setOperationMutationError(result.message); return; } }
    const updated = { ...job, photos: job.photos.filter((item) => item.id !== photo.id) }; setJobs((current) => current.map((item) => item.id === job.id ? updated : item)); setDialog({ type: "job", job: updated }); showToast("Job photo deleted.");
  };
  const moveJob = (id: string, status: JobStatus) => {
    const target = jobs.find((job) => job.id === id);
    if (target) { void updateJob({ ...target, status }); return; }
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status } : job));
    showToast(`Job moved to ${status.replace("-", " ")}.`);
  };
  const updateQuoteStatus = async (quoteId: string, status: Quote["status"]) => {
    if (dataMode === "live") {
      if (!onUpdateQuoteStatus) { setOperationMutationError("Live quote updates are not available."); return; }
      setOperationMutationPending(true);
      const result = await onUpdateQuoteStatus(quoteId, status);
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
      setQuotes((current) => current.map((quote) => quote.id === quoteId ? result.quote : quote));
      setDialog((current) => current?.type === "quote-document" ? { ...current, quote: result.quote } : current);
      showToast(`Quote marked ${status.toLowerCase()}.`);
      return;
    }
    setQuotes((current) => current.map((quote) => quote.id === quoteId ? { ...quote, status } : quote));
    setDialog((current) => current?.type === "quote-document" ? { ...current, quote: { ...current.quote, status } } : current);
    showToast(`Quote marked ${status.toLowerCase()}.`);
  };
  const updateInvoicePaymentStatus = async (invoiceId: string, status: Invoice["paymentStatus"]) => {
    if (dataMode === "live") {
      if (!onUpdateInvoicePayment) { setOperationMutationError("Live invoice updates are not available."); return; }
      setOperationMutationPending(true);
      const result = await onUpdateInvoicePayment(invoiceId, status);
      setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
      setInvoiceRecords((current) => current.map((record) => record.id === invoiceId ? result.invoice : record));
      setDialog((current) => current?.type === "invoice-document" && current.record.id === invoiceId ? { ...current, record: result.invoice } : current);
      showToast(`Invoice payment status set to ${status.toLowerCase()}.`);
      return;
    }
    setInvoiceRecords((current) => current.map((record) => record.id === invoiceId ? { ...record, paymentStatus: status } : record));
    setDialog((current) => current?.type === "invoice-document" && current.record.id === invoiceId ? { ...current, record: { ...current.record, paymentStatus: status } } : current);
    showToast(`Invoice payment status set to ${status.toLowerCase()}.`);
  };
  const persistQuote = async (draft: QuoteDraft) => {
    if (dataMode === "demo") {
      setQuotes((current) => [{ id: `QT-2026-${1000 + current.length + 1}`, client: "Northside Studio", address: "7 McCauley Drive, Booie", issued: "05 Aug 2026", expires: "19 Aug 2026", validDays: 14, status: "Draft", discount: 0, taxRate: 0, ...draft }, ...current]);
      setDialog(null); setActive("quotes"); showToast("Quote saved as draft."); return;
    }
    if (!onSaveQuote) { setOperationMutationError("Live quote saving is not available."); return; }
    setOperationMutationPending(true); const result = await onSaveQuote({ ...draft, items: draft.items.map((item) => ({ ...item, quantity: Number(item.quantity), rate: Number(item.rate) })) }); setOperationMutationPending(false);
    if (!result.ok) { setOperationMutationError(result.message); return; }
    setQuotes((current) => [result.quote, ...current]); setDialog(null); setActive("quotes"); showToast("Quote saved as draft.");
  };
  const persistInvoice = async (draft: InvoiceDraft) => {
    if (dataMode === "demo") { setDialog(null); showToast("Invoice saved as draft."); return; }
    if (!onSaveInvoice) { setOperationMutationError("Live invoice saving is not available."); return; }
    setOperationMutationPending(true); const result = await onSaveInvoice({ ...draft, dueDays: Number(draft.dueDays), items: draft.items.map((item) => ({ ...item, quantity: Number(item.quantity), rate: Number(item.rate) })) }); setOperationMutationPending(false);
    if (!result.ok) { setOperationMutationError(result.message); return; }
    setInvoiceRecords((current) => [result.invoice, ...current]); setDialog(null); showToast("Invoice saved as draft.");
  };
  const persistScheduledJob = async (draft: { jobRequestId: string; scheduledStart: string }) => {
    if (dataMode === "demo") { setDialog(null); showToast("Job scheduled."); return; }
    if (!onScheduleJob) { setOperationMutationError("Live job scheduling is not available."); return; }
    setOperationMutationPending(true); const result = await onScheduleJob(draft); setOperationMutationPending(false);
    if (!result.ok) { setOperationMutationError(result.message); return; }
    setJobs((current) => [...current, result.job]); setDialog(null); showToast("Job scheduled.");
  };
  const finalizeInvoice = async (record: Invoice) => {
    if (dataMode === "live") {
      if (!onFinalizeInvoice) { setOperationMutationError("Live invoice finalizing is not available."); return; }
      setOperationMutationPending(true); const result = await onFinalizeInvoice(record.id); setOperationMutationPending(false);
      if (!result.ok) { setOperationMutationError(result.message); return; }
      setInvoiceRecords((current) => current.map((item) => item.id === record.id ? result.invoice : item)); setDialog({ type: "invoice-document", record: result.invoice }); showToast("Invoice finalized."); return;
    }
    const finalized: Invoice = { ...record, documentStatus: "Finalized" }; setInvoiceRecords((current) => current.map((item) => item.id === finalized.id ? finalized : item)); setDialog({ type: "invoice-document", record: finalized }); showToast("Invoice finalized.");
  };

  const screen = (() => {
    switch (active) {
      case "clients": return <Clients clients={clients} onCreate={() => { setClientMutationError(""); setDialog({ type: "client" }); }} onEdit={(client) => { setClientMutationError(""); setDialog({ type: "client", client }); }} onDelete={(client) => { setClientMutationError(""); setDialog({ type: "delete-client", client }); }} canManage={canManageClients} archiveMode={dataMode === "live"} />;
      case "requests": return <Requests requests={jobRequests} onCreate={() => { setRequestMutationError(""); setDialog({ type: "request" }); }} onQuote={() => setDialog({ type: "quote-form" })} onEstimate={() => setDialog({ type: "estimator" })} onDelete={(request) => { setRequestMutationError(""); setDialog({ type: "delete-request", request }); }} canManage={canManageRequests} />;
      case "questionnaires": return <Questionnaires items={questionnaireItems} submissions={questionnaireSubmissions} onSend={() => setDialog({ type: "send-questionnaire" })} onPreview={(questionnaire) => setDialog({ type: "public-questionnaire", questionnaire })} />;
      case "quotes": return <Quotes quotes={quotes} onNew={() => setDialog({ type: "quote-form" })} onView={(quote) => setDialog({ type: "quote-document", quote })} onEstimate={() => setDialog({ type: "estimator" })} onDelete={(quote) => setDialog({ type: "delete-quote", quote })} />;
      case "schedule": return <Schedule jobs={jobs} onSchedule={() => setDialog({ type: "schedule" })} onJob={(job) => setDialog({ type: "job", job })} />;
      case "jobs": return <JobBoard jobs={jobs} onJob={(job) => setDialog({ type: "job", job })} onMove={moveJob} onDelete={(job) => setDialog({ type: "delete-job", job })} />;
      case "invoices": return <Invoices records={invoiceRecords} onNew={() => setDialog({ type: "invoice-form" })} onView={(record) => setDialog({ type: "invoice-document", record })} onPaymentStatusChange={updateInvoicePaymentStatus} onDelete={(record) => setDialog({ type: "delete-invoice", record })} />;
      default: return <Dashboard jobs={jobs} clients={clients} jobRequests={jobRequests} quotes={quotes} invoices={invoiceRecords} onNavigate={setActive} />;
    }
  })();

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} onEstimate={() => setDialog({ type: "estimator" })} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} signedInEmail={signedInEmail} onSignOut={onSignOut} />
      {mobileOpen ? <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      <div className="app-main">
        <header className="mobile-header"><button aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu aria-hidden="true" /></button><div><small>FieldCentral</small><strong>Pro Console</strong></div></header>
        <main className="workspace">{screen}</main>
      </div>
      {dialog?.type === "estimator" ? <Dialog title="AI Scope & Quote Estimator" titleIcon={Sparkles} onClose={closeDialog}><EstimatorForm onClose={closeDialog} onEstimate={() => { closeDialog(); showToast("Estimate drafted for review."); }} /></Dialog> : null}
      {dialog?.type === "client" ? <Dialog title={dialog.client ? "Edit Client" : "New Client"} onClose={closeDialog} wide><ClientForm client={dialog.client} onClose={closeDialog} onSave={persistClient} pending={clientMutationPending} error={clientMutationError} /></Dialog> : null}
      {dialog?.type === "delete-client" ? <Dialog title={dataMode === "live" ? "Archive client" : "Confirm deletion"} onClose={closeDialog}><ConfirmDelete client={dialog.client} onCancel={closeDialog} onConfirm={() => removeClient(dialog.client)} archiveMode={dataMode === "live"} pending={clientMutationPending} error={clientMutationError} /></Dialog> : null}
      {dialog?.type === "delete-request" ? <Dialog title="Delete job request" onClose={closeDialog}><ConfirmRecordDelete label={`request for ${dialog.request.client}`} kind="job request" onCancel={closeDialog} onConfirm={() => removeJobRequest(dialog.request)} pending={requestMutationPending} error={requestMutationError} /></Dialog> : null}
      {dialog?.type === "delete-quote" ? <Dialog title="Delete quote" onClose={closeDialog}><ConfirmRecordDelete label={dialog.quote.documentNumber || dialog.quote.id} kind="quote" onCancel={closeDialog} onConfirm={() => removeQuote(dialog.quote)} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "delete-job" ? <Dialog title="Delete job" onClose={closeDialog}><ConfirmRecordDelete label={dialog.job.displayName} kind="job" onCancel={closeDialog} onConfirm={() => removeJob(dialog.job)} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "delete-invoice" ? <Dialog title="Delete invoice" onClose={closeDialog}><ConfirmRecordDelete label={dialog.record.documentNumber || dialog.record.id} kind="invoice" onCancel={closeDialog} onConfirm={() => removeInvoice(dialog.record)} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "quote-form" ? <Dialog title="New Quote" onClose={closeDialog} wide><QuoteForm requests={jobRequests} onClose={closeDialog} onSave={persistQuote} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "invoice-form" ? <Dialog title="New Invoice" onClose={closeDialog} wide><InvoiceForm clients={clients} jobs={jobs} onClose={closeDialog} onSave={persistInvoice} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "send-questionnaire" ? <Dialog title="Send Questionnaire" onClose={closeDialog}><SendQuestionnaire items={questionnaireItems} onClose={closeDialog} onSend={onSendQuestionnaire} /></Dialog> : null}
      {dialog?.type === "public-questionnaire" ? <div className="full-screen-layer"><PublicQuestionnaire questionnaire={dialog.questionnaire} onClose={closeDialog} /></div> : null}
      {dialog?.type === "schedule" ? <Dialog title="Schedule Job" onClose={closeDialog}><ScheduleForm requests={jobRequests} onClose={closeDialog} onSchedule={persistScheduledJob} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "job" ? <Dialog title={dialog.job.displayName} onClose={closeDialog} wide><JobDetails job={dialog.job} teamMembers={teamMembers} onClose={closeDialog} onUpdate={updateJob} onAssign={(profileIds) => void assignJob(dialog.job, profileIds)} onUploadPhoto={(file) => void uploadPhoto(dialog.job, file)} onDeletePhoto={(photo) => void removePhoto(dialog.job, photo)} onDelete={(job) => setDialog({ type: "delete-job", job })} pending={operationMutationPending} error={operationMutationError} /></Dialog> : null}
      {dialog?.type === "quote-document" ? <Dialog title={`Quote ${dialog.quote.id}`} onClose={closeDialog} wide document><DocumentView type="quote" record={dialog.quote} onClose={closeDialog} onStatusChange={(status) => updateQuoteStatus(dialog.quote.id, status as Quote["status"])} /></Dialog> : null}
      {dialog?.type === "invoice-document" ? <Dialog title={`Invoice ${dialog.record.documentNumber || dialog.record.id}`} onClose={closeDialog} wide document><DocumentView type="invoice" record={dialog.record} onClose={closeDialog} onStatusChange={(status) => updateInvoicePaymentStatus(dialog.record.id, status as Invoice["paymentStatus"])} onFinalize={() => void finalizeInvoice(dialog.record)} /></Dialog> : null}
      {dialog?.type === "request" ? <Dialog title="New Job Request" onClose={closeDialog}><RequestForm clients={clients} onClose={closeDialog} onSave={persistJobRequest} pending={requestMutationPending} error={requestMutationError} /></Dialog> : null}
      {toast ? <div className="toast" role="status"><CheckCircle2 aria-hidden="true" size={18} />{toast}</div> : null}
    </div>
  );
}
