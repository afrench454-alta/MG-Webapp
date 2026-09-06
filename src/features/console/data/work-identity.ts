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

/**
 * Identifies a job/request by client and property address, then service.
 * Address comes before service so two properties with the same ongoing
 * clean for one client stay distinguishable in dropdowns and calendars.
 */
export function formatWorkLabel(input: WorkIdentityInput): string {
  const client = input.client.trim() || "Client";
  const place =
    compactAddress(input.address) ||
    (input.property && !MISSING_ADDRESS.test(input.property)
      ? input.property.trim()
      : "");
  const service = input.category
    ? displayServiceCategory(input.category)
    : "";
  return uniqueParts([client, place, service]).join(" · ");
}

export function formatJobDisplayName(
  input: WorkIdentityInput & { date?: string | null },
): string {
  const label = formatWorkLabel(input);
  const date = input.date?.trim();
  if (!date || date === "Unscheduled") return label;
  return `${label} · ${date}`;
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
