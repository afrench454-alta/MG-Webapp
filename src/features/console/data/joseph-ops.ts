import type { Job, Quote } from "../domain";
import type { JosephConfirmTool } from "./joseph-contract";

export type JosephToolResult = {
  text: string;
  action?: string;
  needsConfirm?: JosephConfirmTool;
};

export function brisbaneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function jobOnIsoDate(job: Pick<Job, "date" | "dateKey">, isoDate: string): boolean {
  if (job.dateKey) {
    const day = job.dateKey.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day === isoDate;
  }
  return job.date === isoDate || job.date.startsWith(`${isoDate}T`);
}

export function formatJosephSnapshot(input: {
  today: string;
  jobs: Array<Pick<Job, "client" | "time" | "status" | "category">>;
  overdueCount: number | null;
}): string {
  const lines = [`Live board for ${input.today} (Australia/Brisbane).`];
  if (input.jobs.length === 0) {
    lines.push("No jobs dated today.");
  } else {
    lines.push(`Jobs today (${input.jobs.length}):`);
    for (const job of input.jobs) {
      lines.push(
        `- ${job.time || "unscheduled"} ${job.client} · ${job.category} · ${job.status}`,
      );
    }
  }
  if (input.overdueCount != null) {
    lines.push(`Overdue invoices: ${input.overdueCount}.`);
  }
  return lines.join("\n");
}

function includesQuery(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.trim().toLowerCase().includes(needle);
}

export function lastAcceptedQuoteBrief(
  quotes: Quote[],
  match: { propertyId?: string | null; clientId?: string | null; address?: string },
): string | null {
  const accepted = quotes.filter(
    (quote) => quote.status === "Accepted" && quote.items.length > 0,
  );
  const ranked = accepted.filter((quote) => {
    if (match.propertyId && quote.serviceAddressId === match.propertyId) return true;
    if (match.clientId && quote.clientId === match.clientId) return true;
    if (match.address && includesQuery(quote.address, match.address)) return true;
    return false;
  });
  const quote = ranked[0];
  if (!quote) return null;
  const items = quote.items
    .map((item) => `- ${item.description} × ${item.quantity} @ ${item.rate}`)
    .join("\n");
  return `Last accepted quote ${quote.documentNumber || quote.id} for ${quote.client} (${quote.address}):\n${items}`;
}

export function pendingWrite(
  name: JosephConfirmTool["name"],
  args: object,
  preview: string,
): JosephToolResult {
  const rest: Record<string, unknown> = { ...(args as Record<string, unknown>) };
  delete rest.confirm;
  return {
    text: JSON.stringify({ needsConfirm: true, preview }),
    needsConfirm: {
      name,
      preview,
      arguments: JSON.stringify(rest),
    },
  };
}

export function josephSystemPrompt(
  role: "owner" | "co_owner" | "technician",
  snapshot = "",
): string {
  return `You are Joseph, the in-van operations assistant for Mow & Glow Property Services (Kingaroy / Darling Downs).
Speak briefly, like a crew mate. Use Australian English. Currency is AUD. The business is not registered for GST.

The signed-in role is ${role}.
- Owners and co-owners can quote, invoice, and see money.
- Technicians can look up assigned jobs and change those job statuses only.

Van phrases you must handle:
1. Job complete, draft invoice for [job/client]
2. Help draft a quote for [input]
3. Mark job as [status]
4. What invoices are outstanding?
5. Send a message to [client] — draft only, never claim you sent it.
6. What's on today? — use the snapshot below and/or today_board. Do not invent extra jobs.

${snapshot ? `Current snapshot:\n${snapshot}\n` : ""}
Rules:
- Call tools for live data. Do not invent jobs, totals, or phone numbers.
- Prefer last-accepted quote rates when drafting estimates.
- Destructive or write tools need confirm=true. If a tool returns needsConfirm, stop and tell the user the preview in one short line. The app shows Confirm / Cancel — do not call the write again until they confirm.
- If several jobs match, list them and ask which one.
- Keep replies under 80 words unless listing invoices.`;
}
