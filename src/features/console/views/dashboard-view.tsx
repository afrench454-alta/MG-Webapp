"use client";

import {
  ArrowRight,
  ClipboardList,
  Clock3,
  DollarSign,
  ReceiptText,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  brisbaneDateLabel,
  displayNameFromIdentity,
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
  type Quote,
} from "../domain";
import { invoiceDisplayStatus } from "../data/invoice-lifecycle";
import { isLiveInvoice, isLiveQuote } from "../data/list-filters";
import { displayServiceCategory } from "../data/service-catalog";
import { formatSiteTitle } from "../data/work-identity";
import { Badge, EmptyState, PageHeader } from "../components/ui-elements";

export function DashboardView({
  jobs,
  clients,
  jobRequests,
  quotes,
  invoices,
  signedInEmail,
  currentMemberId,
  canManage = true,
  onNavigate,
}: {
  jobs: Job[];
  clients: Client[];
  jobRequests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  signedInEmail?: string;
  currentMemberId?: string;
  canManage?: boolean;
  onNavigate: (route: ConsoleRoute) => void;
}) {
  const liveQuotes = quotes.filter(isLiveQuote);
  const liveInvoices = invoices.filter(isLiveInvoice);
  const myJobs = currentMemberId
    ? jobs.filter((job) => job.assigneeIds.includes(currentMemberId))
    : jobs;
  const fieldJobs = canManage ? jobs : myJobs;
  const upcoming = fieldJobs.find(
    (job) => job.status !== "completed" && job.status !== "cancelled",
  );
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

  const greeting = gdayGreeting(displayNameFromIdentity(undefined, signedInEmail));
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

  const metrics = canManage
    ? [
        {
          label: "Clients",
          value: String(clients.length),
          note: `${clients.filter((client) => client.status === "Lead").length} lead`,
          icon: Users,
          tone: "forest" as const,
        },
        {
          label: "Open job requests",
          value: String(openRequests.length),
          note: `${openRequests.filter((request) => request.status === "Scheduled").length} scheduled`,
          icon: ClipboardList,
          tone: "olive" as const,
        },
        {
          label: "Quotes awaiting",
          value: String(quotesAwaiting.length),
          note: `${liveQuotes.filter((quote) => quote.status === "Accepted").length} accepted`,
          icon: ReceiptText,
          tone: "amber" as const,
        },
        {
          label: "Unpaid invoices",
          value: money(unpaidTotal),
          note: `${money(paidTotal)} paid to date`,
          icon: DollarSign,
          tone: "red" as const,
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
        },
        {
          label: "In progress",
          value: String(
            myJobs.filter((job) => job.status === "in-progress").length,
          ),
          note: "Jobs you have started",
          icon: TrendingUp,
          tone: "olive" as const,
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
        },
        {
          label: "Completed",
          value: String(myJobs.filter((job) => job.status === "completed").length),
          note: "On the board",
          icon: DollarSign,
          tone: "red" as const,
        },
      ];

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={greeting}
        subtitle={`Here's what's happening with your field operations · ${todayLabel}`}
      >
        <span className="live-label">{todayLabel}</span>
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
            <button
              className="text-link"
              onClick={() => onNavigate("schedule")}
            >
              Open schedule <ArrowRight aria-hidden="true" size={16} />
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
                <Icon aria-hidden="true" size={18} /> {label}
              </span>
              <strong>{count}</strong>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}
