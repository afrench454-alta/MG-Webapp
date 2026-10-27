"use client";

import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock3,
  Columns3,
  DollarSign,
  FileText,
  MessageCircle,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  brisbaneDateLabel,
  formatMemberDisplayName,
  gdayGreeting,
} from "@/lib/brand";
import {
  money,
  quoteTotals,
  type Client,
  type ConsoleRoute,
  type Invoice,
  type Job,
  type JobRequest,
  type QuestionnaireSubmission,
  type Quote,
  type TeamMember,
} from "../domain";
import { invoiceDisplayStatus } from "../data/invoice-lifecycle";
import { isLiveInvoice, isLiveQuote } from "../data/list-filters";
import { displayServiceCategory } from "../data/service-catalog";
import { formatSiteTitle } from "../data/work-identity";
import { Badge, Button, EmptyState, PageHeader } from "../components/ui-elements";

export function DashboardView({
  jobs,
  clients,
  jobRequests,
  quotes,
  invoices,
  submissions = [],
  signedInEmail,
  currentMemberId,
  teamMembers = [],
  canManage = true,
  onNavigate,
  onOpenJob,
  onOpenQuote,
  onOpenInvoice,
  onScheduleJob,
  onOpenEstimator,
}: {
  jobs: Job[];
  clients: Client[];
  jobRequests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  submissions?: QuestionnaireSubmission[];
  signedInEmail?: string;
  currentMemberId?: string;
  teamMembers?: TeamMember[];
  canManage?: boolean;
  onNavigate: (route: ConsoleRoute) => void;
  onOpenJob?: (job: Job) => void;
  onOpenQuote?: (quote: Quote) => void;
  onOpenInvoice?: (invoice: Invoice) => void;
  onScheduleJob?: () => void;
  onNewQuote?: () => void;
  onNewInvoice?: () => void;
  onOpenEstimator?: () => void;
}) {
  const liveQuotes = quotes.filter(isLiveQuote);
  const liveInvoices = invoices.filter(isLiveInvoice);
  const myJobs = currentMemberId
    ? jobs.filter((job) => job.assigneeIds.includes(currentMemberId))
    : jobs;
  const fieldJobs = canManage ? jobs : myJobs;
  const activeFieldJobs = fieldJobs.filter(
    (job) => job.status !== "completed" && job.status !== "cancelled",
  );
  const upcoming = activeFieldJobs[0];
  const upcomingDate = upcoming ? new Date(`${upcoming.date} 00:00:00`) : null;
  const openRequests = jobRequests.filter(
    (request) => !["Closed", "Rejected"].includes(request.status),
  );
  const quotesAwaiting = liveQuotes.filter((quote) =>
    ["Draft", "Sent"].includes(quote.status),
  );
  const unpaidTotal = liveInvoices
    .filter(
      (record) =>
        record.paymentStatus !== "Paid" && record.paymentStatus !== "Refunded",
    )
    .reduce(
      (sum, record) =>
        sum +
        quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
      0,
    );
  const paidTotal = liveInvoices
    .filter((record) => record.paymentStatus === "Paid")
    .reduce(
      (sum, record) =>
        sum +
        quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
      0,
    );

  const currentMember =
    teamMembers.find((member) => member.id === currentMemberId) ||
    teamMembers.find(
      (member) => member.email && member.email === signedInEmail,
    ) ||
    teamMembers.find((member) => member.role === "Owner");
  const greeting = gdayGreeting(
    formatMemberDisplayName(
      currentMember?.name,
      signedInEmail,
      currentMember?.role,
    ),
  );
  const todayLabel = brisbaneDateLabel();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const overdueInvoices = liveInvoices.filter(
    (record) => invoiceDisplayStatus(record) === "Overdue",
  ).length;
  const siteVisitsDue = fieldJobs.filter((job) => {
    if (job.status !== "scheduled" && job.status !== "in-progress") return false;
    const day = job.dateKey?.slice(0, 10);
    return Boolean(day) && day <= todayKey;
  }).length;

  const totalProperties = clients.reduce(
    (sum, client) => sum + client.properties.length,
    0,
  );
  const activeClientsCount = clients.filter(
    (client) => client.status === "Active",
  ).length;
  const unactionedSubmissions = submissions.filter(
    (sub) => !sub.jobRequestId,
  ).length;

  const inProgressCount = fieldJobs.filter(
    (job) => job.status === "in-progress",
  ).length;
  const scheduledCount = fieldJobs.filter(
    (job) => job.status === "scheduled",
  ).length;

  // 4 Top Metric Cards
  const metrics = canManage
    ? [
        {
          label: "Clients",
          value: String(clients.length),
          note: `${clients.filter((client) => client.status === "Lead").length} lead`,
          icon: Users,
          tone: "forest" as const,
          route: "clients" as ConsoleRoute,
          ratio: clients.length
            ? Math.round((activeClientsCount / clients.length) * 100)
            : 100,
        },
        {
          label: "Open job requests",
          value: String(openRequests.length),
          note: `${openRequests.filter((request) => request.status === "Scheduled").length} scheduled`,
          icon: ClipboardList,
          tone: "olive" as const,
          route: "requests" as ConsoleRoute,
          ratio: openRequests.length
            ? Math.min(
                100,
                Math.round(
                  (openRequests.filter((r) => r.status === "Scheduled").length /
                    openRequests.length) *
                    100,
                ) || 35,
              )
            : 100,
        },
        {
          label: "Quotes awaiting",
          value: String(quotesAwaiting.length),
          note: `${liveQuotes.filter((quote) => quote.status === "Accepted").length} accepted`,
          icon: ReceiptText,
          tone: "amber" as const,
          route: "quotes" as ConsoleRoute,
          ratio: liveQuotes.length
            ? Math.round(
                (liveQuotes.filter((q) => q.status === "Accepted").length /
                  liveQuotes.length) *
                  100,
              ) || 45
            : 100,
        },
        {
          label: "Unpaid invoices",
          value: money(unpaidTotal),
          note: `${money(paidTotal)} paid to date`,
          icon: DollarSign,
          tone: "red" as const,
          route: "invoices" as ConsoleRoute,
          ratio:
            unpaidTotal + paidTotal > 0
              ? Math.round((paidTotal / (unpaidTotal + paidTotal)) * 100) || 30
              : 100,
        },
      ]
    : [
        {
          label: "Assigned to me",
          value: String(
            myJobs.filter(
              (job) => job.status !== "completed" && job.status !== "cancelled",
            ).length,
          ),
          note: `${myJobs.filter((job) => job.status === "scheduled").length} scheduled`,
          icon: ClipboardList,
          tone: "forest" as const,
          route: "jobs" as ConsoleRoute,
          ratio: 75,
        },
        {
          label: "In progress",
          value: String(
            myJobs.filter((job) => job.status === "in-progress").length,
          ),
          note: "Jobs you have started",
          icon: TrendingUp,
          tone: "olive" as const,
          route: "jobs" as ConsoleRoute,
          ratio: 60,
        },
        {
          label: "Site visits due",
          value: String(
            myJobs.filter((job) => {
              if (job.status !== "scheduled" && job.status !== "in-progress")
                return false;
              const day = job.dateKey?.slice(0, 10);
              return Boolean(day) && day <= todayKey;
            }).length,
          ),
          note: "Scheduled through today",
          icon: Clock3,
          tone: "amber" as const,
          route: "schedule" as ConsoleRoute,
          ratio: 80,
        },
        {
          label: "Completed",
          value: String(myJobs.filter((job) => job.status === "completed").length),
          note: "On the board",
          icon: DollarSign,
          tone: "red" as const,
          route: "jobs" as ConsoleRoute,
          ratio: 100,
        },
      ];

  // Immediate Action Queue
  const immediateActions: Array<{
    id: string;
    tag: string;
    tone: "red" | "amber" | "olive" | "forest";
    title: string;
    subtitle: string;
    cta: string;
    onAction: () => void;
  }> = [];

  if (canManage) {
    for (const inv of liveInvoices) {
      if (invoiceDisplayStatus(inv) === "Overdue") {
        const total = quoteTotals(
          inv.items,
          inv.discount ?? 0,
          inv.taxRate ?? 0,
        ).total;
        immediateActions.push({
          id: `act-inv-${inv.id}`,
          tag: "Overdue Invoice",
          tone: "red",
          title: `${inv.documentNumber || inv.id} · ${inv.client}`,
          subtitle: `${money(total)} overdue since ${inv.dueDate} · ${inv.address}`,
          cta: "Review",
          onAction: () =>
            onOpenInvoice ? onOpenInvoice(inv) : onNavigate("invoices"),
        });
      }
    }
  }

  for (const job of fieldJobs) {
    if (job.status === "on-hold") {
      immediateActions.push({
        id: `act-hold-${job.id}`,
        tag: "On Hold",
        tone: "amber",
        title: formatSiteTitle(job),
        subtitle: job.notes || `${displayServiceCategory(job.category)} · ${job.address}`,
        cta: "Resolve",
        onAction: () => (onOpenJob ? onOpenJob(job) : onNavigate("jobs")),
      });
    }
  }

  for (const req of openRequests.slice(0, 2)) {
    immediateActions.push({
      id: `act-req-${req.id}`,
      tag: `Request · ${req.status}`,
      tone: "olive",
      title: formatSiteTitle(req),
      subtitle: `${displayServiceCategory(req.category)} · ${req.scope || req.address}`,
      cta: "Triage",
      onAction: () => onNavigate("requests"),
    });
  }

  if (canManage) {
    for (const quote of quotesAwaiting.slice(0, 1)) {
      const total = quoteTotals(
        quote.items,
        quote.discount ?? 0,
        quote.taxRate ?? 0,
      ).total;
      immediateActions.push({
        id: `act-quote-${quote.id}`,
        tag: `Quote ${quote.status}`,
        tone: "forest",
        title: `${quote.documentNumber || quote.id} · ${quote.client}`,
        subtitle: `${money(total)} · ${quote.scope || quote.address}`,
        cta: "Open",
        onAction: () =>
          onOpenQuote ? onOpenQuote(quote) : onNavigate("quotes"),
      });
    }
  }

  return (
    <div className="dashboard-hub">
      <PageHeader
        eyebrow="Today"
        title={greeting}
        subtitle={`Here's what's happening with your field operations · ${todayLabel}`}
      >
        <span className="live-label">{todayLabel}</span>
        {canManage && onScheduleJob ? (
          <Button
            variant="secondary"
            icon={CalendarPlus}
            onClick={onScheduleJob}
          >
            Schedule Job
          </Button>
        ) : null}
        {canManage && onOpenEstimator ? (
          <Button icon={Sparkles} onClick={onOpenEstimator}>
            AI Estimator
          </Button>
        ) : null}
      </PageHeader>

      {/* Sleek KPI Metrics Strip */}
      <section className="metric-grid" aria-label="Business metrics">
        {metrics.map(({ label, value, note, icon: Icon, tone, route, ratio }) => (
          <article
            className="metric-card metric-card--interactive"
            key={label}
            onClick={() => onNavigate(route)}
          >
            <div className="metric-card__main">
              <p className="eyebrow">{label}</p>
              <strong>{value}</strong>
              <span>{note}</span>
              <div className="metric-card__bar" aria-hidden="true">
                <i
                  className={`metric-card__bar-fill metric-card__bar-fill--${tone}`}
                  style={{ width: `${Math.max(12, Math.min(100, ratio))}%` }}
                />
              </div>
            </div>
            <div className={`metric-icon metric-icon--${tone}`}>
              <Icon aria-hidden="true" size={20} />
            </div>
          </article>
        ))}
      </section>

      {/* 3 Streamlined Operational Sections (Direct Access to App Areas) */}
      <section className="hub-domains-strip" aria-label="Operational areas">
        {/* Section 1: Field Operations */}
        <div className="hub-domain-card">
          <div className="hub-domain-card__header">
            <span className="hub-domain-card__icon hub-domain-card__icon--forest">
              <Columns3 aria-hidden="true" size={17} />
            </span>
            <div>
              <h3>Field Operations</h3>
              <small>{inProgressCount} active · {scheduledCount} scheduled</small>
            </div>
          </div>
          <div className="hub-domain-card__links">
            <button
              type="button"
              className="hub-domain-pill"
              aria-label="View schedule calendar"
              onClick={() => onNavigate("schedule")}
            >
              <CalendarDays aria-hidden="true" size={13} />
              <span>Schedule</span>
            </button>
            <button
              type="button"
              className="hub-domain-pill"
              aria-label="View job board kanban"
              onClick={() => onNavigate("jobs")}
            >
              <Columns3 aria-hidden="true" size={13} />
              <span>Jobs{jobs.length > 0 ? ` (${jobs.length})` : ""}</span>
            </button>
            <button
              type="button"
              className="hub-domain-pill"
              aria-label="Open Joseph AI assistant"
              onClick={() => onNavigate("joseph")}
            >
              <MessageCircle aria-hidden="true" size={13} />
              <span>Joseph</span>
            </button>
          </div>
        </div>

        {/* Section 2: Clients & Intake */}
        <div className="hub-domain-card">
          <div className="hub-domain-card__header">
            <span className="hub-domain-card__icon hub-domain-card__icon--olive">
              <Users aria-hidden="true" size={17} />
            </span>
            <div>
              <h3>Client & Intake</h3>
              <small>
                {clients.length} clients · {totalProperties} sites
                {unactionedSubmissions > 0
                  ? ` · ${unactionedSubmissions} pending intake`
                  : ""}
              </small>
            </div>
          </div>
          <div className="hub-domain-card__links">
            {canManage ? (
              <button
                type="button"
                className="hub-domain-pill"
                aria-label="View clients directory"
                onClick={() => onNavigate("clients")}
              >
                <Users aria-hidden="true" size={13} />
                <span>Clients</span>
              </button>
            ) : null}
            <button
              type="button"
              className="hub-domain-pill"
              aria-label="View incoming job requests"
              onClick={() => onNavigate("requests")}
            >
              <ClipboardList aria-hidden="true" size={13} />
              <span>
                Requests{openRequests.length > 0 ? ` (${openRequests.length})` : ""}
              </span>
            </button>
            {canManage ? (
              <button
                type="button"
                className="hub-domain-pill"
                aria-label="View client intake forms"
                onClick={() => onNavigate("questionnaires")}
              >
                <FileText aria-hidden="true" size={13} />
                <span>Intake</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Section 3: Financials & Admin */}
        <div className="hub-domain-card">
          <div className="hub-domain-card__header">
            <span className="hub-domain-card__icon hub-domain-card__icon--amber">
              <ReceiptText aria-hidden="true" size={17} />
            </span>
            <div>
              <h3>Financials & Admin</h3>
              <small>
                {quotesAwaiting.length} quotes · {liveInvoices.length} invoices
              </small>
            </div>
          </div>
          <div className="hub-domain-card__links">
            {canManage ? (
              <>
                <button
                  type="button"
                  className="hub-domain-pill"
                  aria-label="View outstanding quotes"
                  onClick={() => onNavigate("quotes")}
                >
                  <ReceiptText aria-hidden="true" size={13} />
                  <span>
                    Quotes{quotesAwaiting.length > 0 ? ` (${quotesAwaiting.length})` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="hub-domain-pill"
                  aria-label="View billing invoices"
                  onClick={() => onNavigate("invoices")}
                >
                  <DollarSign aria-hidden="true" size={13} />
                  <span>Invoices</span>
                </button>
                <button
                  type="button"
                  className="hub-domain-pill"
                  aria-label="View team and settings"
                  onClick={() => onNavigate("settings")}
                >
                  <Users aria-hidden="true" size={13} />
                  <span>Team</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="hub-domain-pill"
                aria-label="View assigned requests"
                onClick={() => onNavigate("requests")}
              >
                <span>Job Requests</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Operational Split: Work Queue (60%) + Ops Pulse (40%) */}
      <section className="dashboard-grid">
        <article className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Work Queue</p>
              <h2>Next Scheduled Job</h2>
            </div>
            <button
              className="text-link"
              onClick={() => onNavigate("schedule")}
            >
              Open schedule <ArrowRight aria-hidden="true" size={15} />
            </button>
          </div>
          {upcoming ? (
            <button
              className="upcoming-job"
              onClick={() => onNavigate("jobs")}
            >
              <span className="date-tile">
                <small>
                  {upcomingDate && !Number.isNaN(upcomingDate.getTime())
                    ? new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(
                        upcomingDate,
                      )
                    : "Job"}
                </small>
                <strong>
                  {upcomingDate && !Number.isNaN(upcomingDate.getTime())
                    ? upcomingDate.getDate()
                    : "—"}
                </strong>
              </span>
              <span className="upcoming-job__details">
                <strong>{formatSiteTitle(upcoming)}</strong>
                <small>
                  {upcoming.time ? `${upcoming.time} · ` : ""}
                  {displayServiceCategory(upcoming.category)}
                  {upcoming.assignees.length
                    ? ` · Crew: ${upcoming.assignees.join(", ")}`
                    : ""}
                </small>
              </span>
              <Badge tone="neutral">{upcoming.status.replace("-", " ")}</Badge>
            </button>
          ) : (
            <EmptyState
              title="No scheduled jobs"
              action="Schedule a job"
              onAction={() => onNavigate("schedule")}
            />
          )}

          {immediateActions.length ? (
            <div className="hub-action-queue">
              <div className="hub-action-queue__header">
                <p className="eyebrow">Action Queue</p>
                <span>{immediateActions.length} item{immediateActions.length === 1 ? "" : "s"} need attention</span>
              </div>
              <div className="hub-action-queue__list">
                {immediateActions.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className={`hub-action-item hub-action-item--${item.tone}`}
                  >
                    <div className="hub-action-item__copy">
                      <div className="hub-action-item__meta">
                        <Badge
                          tone={
                            item.tone === "red"
                              ? "unpaid"
                              : item.tone === "amber"
                                ? "amber"
                                : item.tone === "olive"
                                  ? "olive"
                                  : "forest"
                          }
                        >
                          {item.tag}
                        </Badge>
                        <strong>{item.title}</strong>
                      </div>
                      <small>{item.subtitle}</small>
                    </div>
                    <button
                      type="button"
                      className="button button--secondary hub-action-item__btn"
                      onClick={item.onAction}
                    >
                      <span>{item.cta}</span>
                      <ArrowRight aria-hidden="true" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel ops-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ops pulse</p>
              <h2>Right now</h2>
            </div>
          </div>
          {(
            (
              canManage
                ? [
                    [
                      TrendingUp,
                      "Jobs in progress",
                      jobs.filter((job) => job.status === "in-progress").length,
                    ],
                    [Clock3, "Site visits due", siteVisitsDue],
                    [
                      ReceiptText,
                      "Quotes to send",
                      liveQuotes.filter((quote) => quote.status === "Draft").length,
                    ],
                    [DollarSign, "Invoices overdue", overdueInvoices],
                  ]
                : [
                    [
                      TrendingUp,
                      "Jobs in progress",
                      myJobs.filter((job) => job.status === "in-progress").length,
                    ],
                    [Clock3, "Site visits due", siteVisitsDue],
                    [
                      ClipboardList,
                      "Unassigned jobs",
                      jobs.filter((job) => !job.assigneeIds.length).length,
                    ],
                    [
                      ReceiptText,
                      "On hold",
                      myJobs.filter((job) => job.status === "on-hold").length,
                    ],
                  ]
            ) satisfies Array<[LucideIcon, string, number]>
          ).map(([Icon, label, count]) => (
            <div className="ops-row" key={label}>
              <span>
                <Icon aria-hidden="true" size={16} /> {label}
              </span>
              <strong>{count}</strong>
            </div>
          ))}

          {teamMembers.length ? (
            <div className="hub-crew-roster">
              <div className="hub-crew-roster__header">
                <p className="eyebrow">Field Crew</p>
                {canManage ? (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => onNavigate("settings")}
                  >
                    Manage
                  </button>
                ) : null}
              </div>
              <div className="hub-crew-roster__list">
                {teamMembers
                  .filter((member) => member.isActive)
                  .slice(0, 3)
                  .map((member) => {
                    const memberActiveJobs = jobs.filter(
                      (job) =>
                        (job.status === "in-progress" ||
                          job.status === "scheduled") &&
                        job.assigneeIds.includes(member.id),
                    );
                    return (
                      <div className="hub-crew-row" key={member.id}>
                        <span className="hub-crew-avatar" aria-hidden="true">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div className="hub-crew-info">
                          <strong>{member.name}</strong>
                          <small>
                            {member.role} ·{" "}
                            {memberActiveJobs.length
                              ? `${memberActiveJobs.length} job${memberActiveJobs.length === 1 ? "" : "s"}`
                              : "Standby"}
                          </small>
                        </div>
                        <Badge
                          tone={
                            memberActiveJobs.some(
                              (j) => j.status === "in-progress",
                            )
                              ? "forest"
                              : memberActiveJobs.length
                                ? "sage"
                                : "neutral"
                          }
                        >
                          {memberActiveJobs.some(
                            (j) => j.status === "in-progress",
                          )
                            ? "On Site"
                            : memberActiveJobs.length
                              ? "Scheduled"
                              : "Standby"}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
