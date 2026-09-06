import { displayServiceCategory } from "./service-catalog";

export type WorkIdentityInput = {
  client: string;
  address?: string | null;
  property?: string | null;
  category?: string | null;
};

const MISSING_ADDRESS = /^(no service address|no billing address|service property)$/i;

export function compactAddress(address?: string | null): string {
  const trimmed = address?.trim() || "";
  if (!trimmed || MISSING_ADDRESS.test(trimmed)) return "";
  return trimmed.replace(/,?\s*australia$/i, "").trim();
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function sitePlace(input: WorkIdentityInput): string {
  return (
    compactAddress(input.address) ||
    (input.property && !MISSING_ADDRESS.test(input.property)
      ? input.property.trim()
      : "")
  );
}

/**
 * The operational identity of a job: client + property.
 * Service type is a tag, not the identifier — one client can have two
 * ongoing cleans on the same day at different addresses.
 */
export function formatSiteTitle(input: WorkIdentityInput): string {
  const client = input.client.trim() || "Client";
  return uniqueParts([client, sitePlace(input)]).join(" · ");
}

/**
 * Identifies a job/request by client and property address, then service.
 * Address comes before service so two properties with the same ongoing
 * clean for one client stay distinguishable in dropdowns and calendars.
 */
export function formatWorkLabel(input: WorkIdentityInput): string {
  const service = input.category
    ? displayServiceCategory(input.category)
    : "";
  return uniqueParts([formatSiteTitle(input), service]).join(" · ");
}

export function formatJobDisplayName(
  input: WorkIdentityInput & { date?: string | null },
): string {
  const label = formatWorkLabel(input);
  const date = input.date?.trim();
  if (!date || date === "Unscheduled") return label;
  return `${label} · ${date}`;
}

export function formatCalendarEvent(
  input: WorkIdentityInput & { time?: string | null },
): { primary: string; secondary: string } {
  const place = sitePlace(input) || "Property";
  const time = input.time?.trim();
  return {
    primary: time ? `${time} · ${place}` : place,
    secondary: input.client.trim() || "Client",
  };
}

export function formatSubmissionScope(
  answers: Record<string, string | string[]>,
  fields: Array<{ id: string; label: string }>,
): string {
  const lines = fields
    .map((field) => {
      const value = answers[field.id];
      if (value == null || value === "") return "";
      const text = Array.isArray(value)
        ? value.filter(Boolean).join(", ")
        : String(value).trim();
      if (!text) return "";
      return `${field.label}: ${text}`;
    })
    .filter(Boolean);

  const site = answers._site_address;
  if (typeof site === "string" && site.trim()) {
    lines.unshift(`Property address: ${site.trim()}`);
  }

  return lines.join("\n");
}

export function submissionSiteAddress(
  answers: Record<string, string | string[]>,
): string {
  const site = answers._site_address;
  return typeof site === "string" ? compactAddress(site) : "";
}

function brisbaneYmd(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonthStart(now: Date = new Date()): Date {
  const [year, month] = brisbaneYmd(now).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** datetime-local value in Australia/Brisbane, snapped to the next working hour. */
export function defaultDateTimeLocal(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Brisbane",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const today = brisbaneYmd(now);
  if (hour >= 17) {
    const tomorrow = new Date(`${today}T12:00:00+10:00`);
    tomorrow.setTime(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    return `${brisbaneYmd(tomorrow)}T09:00`;
  }
  const nextHour = Math.max(hour + 1, 8);
  return `${today}T${String(nextHour).padStart(2, "0")}:00`;
}
