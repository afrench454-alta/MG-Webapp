import { money, type Invoice, type Job, type JobRequest, type QuestionnaireSubmission, type Quote } from "../domain";
import { invoiceAmounts, invoiceDisplayStatus } from "./invoice-lifecycle";
import { isLiveQuote } from "./list-filters";
import { formatSiteTitle, brisbaneDateKey } from "./work-identity";

export type OperationalAlert = {
  id: string;
  urgent: boolean;
  tag: string;
  title: string;
  detail?: string;
  meta?: string;
  action: string;
  target:
    | { type: "job"; record: Job }
    | { type: "request"; record: JobRequest }
    | { type: "quote"; record: Quote }
    | { type: "invoice"; record: Invoice }
    | { type: "submission"; record: QuestionnaireSubmission };
};

export function operationalAlerts({
  canManage, actorId, jobs, requests, quotes, invoices, submissions, now = new Date(),
}: {
  canManage: boolean;
  actorId?: string;
  jobs: Job[];
  requests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  submissions: QuestionnaireSubmission[];
  now?: Date;
}) {
  const today = brisbaneDateKey(now);
  const alerts: OperationalAlert[] = [];
  for (const job of jobs) {
    if (job.status === "on-hold" && (canManage || (actorId && job.assigneeIds.includes(actorId)))) {
      alerts.push({
        id: `hold-${job.id}`, urgent: true, tag: "Job on hold", title: formatSiteTitle(job),
        detail: job.scope, meta: job.date, action: "Open job", target: { type: "job", record: job },
      });
    } else if (canManage && ["scheduled", "in-progress"].includes(job.status) && !job.assigneeIds.length) {
      alerts.push({
        id: `unassigned-${job.id}`, urgent: Boolean(job.dateKey && job.dateKey.slice(0, 10) <= today),
        tag: "Unassigned crew", title: formatSiteTitle(job), meta: job.date,
        action: "Assign crew", target: { type: "job", record: job },
      });
    }
  }
  if (!canManage) return alerts;
  for (const record of invoices) {
    const balance = invoiceAmounts(record).balanceDue;
    if (invoiceDisplayStatus(record, now) !== "Overdue" || balance <= 0) continue;
    alerts.push({
      id: `overdue-${record.id}`, urgent: true, tag: "Overdue invoice",
      title: `${record.documentNumber || record.id} · ${record.client}`, meta: `${money(balance)} outstanding`,
      action: "Review invoice", target: { type: "invoice", record },
    });
  }
  for (const record of requests) {
    if (!["New", "Quoting"].includes(record.status)) continue;
    alerts.push({
      id: `request-${record.id}`, urgent: false, tag: `Request · ${record.status}`,
      title: formatSiteTitle(record), detail: record.scope, action: "View request",
      target: { type: "request", record },
    });
  }
  for (const record of submissions) {
    if (record.jobRequestId) continue;
    alerts.push({
      id: `submission-${record.id}`, urgent: false, tag: "Intake submission",
      title: `${record.respondent} · ${record.questionnaire}`, action: "Review answers",
      target: { type: "submission", record },
    });
  }
  for (const record of quotes) {
    if (!isLiveQuote(record) || !["Draft", "Sent"].includes(record.status)) continue;
    alerts.push({
      id: `quote-${record.id}`, urgent: false, tag: `Quote · ${record.status}`,
      title: `${record.documentNumber || record.id} · ${record.client}`,
      detail: record.scope, action: "Open quote", target: { type: "quote", record },
    });
  }
  return alerts.sort((left, right) => Number(right.urgent) - Number(left.urgent));
}
