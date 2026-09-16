import { TEAM_INBOX, productBrand } from "@/lib/brand";
import { dateKeyToIso } from "./job-recurrence";
import { formatSiteTitle } from "./work-identity";

export type CalendarJob = {
  id: string;
  client: string;
  address?: string | null;
  property?: string | null;
  category?: string | null;
  scope?: string | null;
  dateKey: string;
  status?: string;
  assignees?: string[];
};

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsStamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let remaining = line;
  chunks.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join("\r\n");
}

function brisbaneLocalStamp(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}00`;
}

function jobWindow(job: CalendarJob): { start: string; end: string } | null {
  const iso = dateKeyToIso(job.dateKey);
  if (!iso) return null;
  const start = new Date(iso);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function jobToVEvent(
  job: CalendarJob,
  organizerEmail = TEAM_INBOX,
): string | null {
  const window = jobWindow(job);
  if (!window) return null;
  const summary = formatSiteTitle(job);
  const description = [
    job.category,
    job.scope,
    job.assignees?.length ? `Crew: ${job.assignees.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:${job.id}@mowglowpropertyservices.com.au`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART;TZID=Australia/Brisbane:${brisbaneLocalStamp(window.start)}`,
    `DTEND;TZID=Australia/Brisbane:${brisbaneLocalStamp(window.end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape((job.address || "").trim())}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `ORGANIZER;CN="${icsEscape(productBrand)}":mailto:${organizerEmail}`,
    "END:VEVENT",
  ];
  return lines.map(foldLine).join("\r\n");
}

export function jobsToIcs(
  jobs: CalendarJob[],
  organizerEmail = TEAM_INBOX,
): string {
  const events = jobs
    .filter((job) => job.status !== "cancelled" && job.dateKey)
    .map((job) => jobToVEvent(job, organizerEmail))
    .filter((event): event is string => Boolean(event));
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${productBrand}//Console//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${productBrand} jobs`)}`,
    "X-WR-TIMEZONE:Australia/Brisbane",
    ...events,
    "END:VCALENDAR",
  ];
  return `${body.join("\r\n")}\r\n`;
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
