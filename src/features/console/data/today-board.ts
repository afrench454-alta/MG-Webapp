import type { Invoice, Job } from "../domain";
import { money, quoteTotals } from "../domain";
import { invoiceDisplayStatus } from "./invoice-lifecycle";
import { isLiveInvoice } from "./list-filters";
import { visibleNextStopJobs } from "./joseph-next-stop";

export function brisbaneDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return dayKey;
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function jobDayKey(job: Pick<Job, "dateKey">): string {
  return job.dateKey.slice(0, 10);
}

export function jobsOnDay(
  jobs: Job[],
  dayKey: string,
  actor?: { actorId?: string; actorRole?: "owner" | "co_owner" | "technician" },
): Job[] {
  return visibleNextStopJobs(jobs, actor)
    .filter((job) => jobDayKey(job) === dayKey)
    .sort((a, b) => (a.dateKey || "").localeCompare(b.dateKey || ""));
}

export function buildJosephSnapshot(input: {
  jobs: Job[];
  invoices: Invoice[];
  actorId?: string;
  actorRole?: "owner" | "co_owner" | "technician";
  now?: Date;
}): string {
  const day = brisbaneDayKey(input.now);
  const today = jobsOnDay(input.jobs, day, input).slice(0, 5);
  const outstanding = input.invoices
    .filter((invoice) => {
      if (!isLiveInvoice(invoice)) return false;
      const display = invoiceDisplayStatus(invoice, input.now);
      return display !== "Paid" && display !== "Refunded" && display !== "Void";
    })
    .slice(0, 5)
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.documentNumber || invoice.id,
      client: invoice.client,
      display: invoiceDisplayStatus(invoice, input.now),
      total: money(quoteTotals(invoice.items, invoice.discount ?? 0, invoice.taxRate ?? 0).total),
    }));

  const jobLines = today.length
    ? today
        .map((job) => `- ${job.id} ${job.client} @ ${job.address} (${job.status}${job.time ? `, ${job.time}` : ""})`)
        .join("\n")
    : "- none";
  const invoiceLines =
    input.actorRole === "technician"
      ? "- hidden for technicians"
      : outstanding.length
        ? outstanding
            .map((invoice) => `- ${invoice.id} ${invoice.number} ${invoice.client} ${invoice.display} ${invoice.total}`)
            .join("\n")
        : "- none";

  return [
    `Live snapshot for ${day} (Australia/Brisbane). Use these ids; do not invent records.`,
    `Today's jobs:`,
    jobLines,
    `Outstanding invoices:`,
    invoiceLines,
  ].join("\n");
}
