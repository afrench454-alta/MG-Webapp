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
import { Badge, EmptyState, PageHeader } from "../components/ui-elements";

export function DashboardView({
  jobs,
  clients,
  jobRequests,
  quotes,
  invoices,
  signedInEmail,
  onNavigate,
}: {
  jobs: Job[];
  clients: Client[];
  jobRequests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  signedInEmail?: string;
  onNavigate: (route: ConsoleRoute) => void;
}) {
  const upcoming = jobs.find((job) => job.status !== "completed");
  const upcomingDate = upcoming ? new Date(`${upcoming.date} 00:00:00`) : null;
  const openRequests = jobRequests.filter(
    (request) => !["Closed", "Rejected"].includes(request.status),
  );
  const quotesAwaiting = quotes.filter((quote) =>
    ["Draft", "Sent"].includes(quote.status),
  );
  const unpaidTotal = invoices
    .filter((record) =>
      record.documentStatus !== "Void" &&
      record.paymentStatus !== "Paid" &&
      record.paymentStatus !== "Refunded",
    )
    .reduce(
      (sum, record) =>
        sum +
        quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
      0,
    );
  const paidTotal = invoices
    .filter((record) => record.paymentStatus === "Paid")
    .reduce(
      (sum, record) =>
        sum +
        quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
      0,
    );

  const metrics = [
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
      note: `${quotes.filter((quote) => quote.status === "Accepted").length} accepted`,
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
  ];

  const greeting = gdayGreeting(displayNameFromIdentity(undefined, signedInEmail));
  const todayLabel = brisbaneDateLabel();
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const overdueInvoices = invoices.filter(
    (record) => invoiceDisplayStatus(record) === "Overdue",
  ).length;
  const siteVisitsDue = jobs.filter((job) => {
    if (job.status !== "scheduled" && job.status !== "in-progress") return false;
    const day = job.dateKey?.slice(0, 10);
    return Boolean(day) && day <= todayKey;
  }).length;

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
                <strong>{upcoming.client}</strong>
                <small>
                  {upcoming.category} · {upcoming.address}
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
            [
              [
                TrendingUp,
                "Jobs in progress",
                jobs.filter((job) => job.status === "in-progress").length,
              ],
              [Clock3, "Site visits due", siteVisitsDue],
              [
                ReceiptText,
                "Quotes to send",
                quotes.filter((quote) => quote.status === "Draft").length,
              ],
              [DollarSign, "Invoices overdue", overdueInvoices],
            ] satisfies Array<[LucideIcon, string, number]>
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
