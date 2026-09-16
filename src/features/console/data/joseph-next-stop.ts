import { money, quoteTotals, type Client, type Invoice, type Job, type Quote } from "../domain";
import { invoiceDisplayStatus } from "./invoice-lifecycle";
import { isLiveInvoice } from "./list-filters";

export const JOSEPH_DRAFT_INVOICE_CONFIRM = "Draft invoice";

export const NEXT_STOP_OPS_STATUSES = [
  "Scheduled",
  "En route",
  "Running late",
  "In progress",
  "Done",
] as const;

export type NextStopOpsStatus = (typeof NEXT_STOP_OPS_STATUSES)[number];

export const NEXT_STOP_ACTION_CHIPS = [
  { id: "on-my-way", label: "On my way" },
  { id: "running-late", label: "Running late" },
  { id: "done-draft-invoice", label: "Done → Draft invoice" },
] as const;

export type NextStopChipId = (typeof NEXT_STOP_ACTION_CHIPS)[number]["id"];

export type NextStopBrief = {
  jobId: string;
  jobStatus: Job["status"];
  clientId: string | null;
  clientName: string;
  address: string;
  notes: string;
  date: string;
  time: string;
  opsStatus: NextStopOpsStatus;
  balance: number;
  balanceLabel: string;
  outstandingCount: number;
  quoteId: string | null;
  hasLinkedQuote: boolean;
};

export type NextStopToolCall = {
  name: string;
  args: Record<string, unknown>;
};

function isOpenJob(job: Job): boolean {
  return job.status !== "completed" && job.status !== "cancelled";
}

function byDateKey(a: Job, b: Job): number {
  return (a.dateKey || "").localeCompare(b.dateKey || "");
}

export function visibleNextStopJobs(
  jobs: Job[],
  actor?: { actorId?: string; actorRole?: "owner" | "co_owner" | "technician" },
): Job[] {
  const actorId = actor?.actorId;
  if (actor?.actorRole === "technician" && actorId) {
    return jobs.filter((job) => job.assigneeIds.includes(actorId));
  }
  return jobs;
}

export function pickNextStopJob(jobs: Job[]): Job | undefined {
  const open = jobs.filter(isOpenJob);
  const inProgress = open.filter((job) => job.status === "in-progress").sort(byDateKey);
  if (inProgress[0]) return inProgress[0];
  return [...open].sort(byDateKey)[0];
}

export type NextStopOpsOverlay = Extract<NextStopOpsStatus, "En route" | "Running late" | "Done">;

export function nextStopOpsStatus(
  jobStatus: Job["status"] | undefined,
  overlay?: NextStopOpsOverlay | null,
): NextStopOpsStatus {
  if (jobStatus === "completed" || overlay === "Done") return "Done";
  if (overlay === "En route" || overlay === "Running late") return overlay;
  if (jobStatus === "in-progress") return "In progress";
  return "Scheduled";
}

export function linkedAcceptedQuote(job: Job, quotes: Quote[]): Quote | undefined {
  if (!job.jobRequestId) return undefined;
  return quotes.find(
    (quote) => quote.jobRequestId === job.jobRequestId && quote.status === "Accepted",
  );
}

export function outstandingInvoicesForClient(
  invoices: Invoice[],
  client: { id?: string | null; name: string },
): Invoice[] {
  return invoices.filter((invoice) => {
    if (!isLiveInvoice(invoice)) return false;
    const display = invoiceDisplayStatus(invoice);
    if (display === "Paid" || display === "Refunded" || display === "Void") return false;
    if (client.id && invoice.clientId) return invoice.clientId === client.id;
    return invoice.client === client.name;
  });
}

function invoiceBalance(invoice: Invoice): number {
  return quoteTotals(invoice.items, invoice.discount ?? 0, invoice.taxRate ?? 0).total;
}

export function buildNextStopBrief(input: {
  jobs: Job[];
  clients: Client[];
  invoices: Invoice[];
  quotes: Quote[];
  actorId?: string;
  actorRole?: "owner" | "co_owner" | "technician";
  overlay?: NextStopOpsOverlay | null;
}): NextStopBrief | null {
  const job = pickNextStopJob(visibleNextStopJobs(input.jobs, input));
  if (!job) return null;

  const client =
    (job.clientId ? input.clients.find((item) => item.id === job.clientId) : undefined) ||
    input.clients.find((item) => item.name === job.client);
  const outstanding = outstandingInvoicesForClient(input.invoices, {
    id: job.clientId || client?.id,
    name: job.client,
  });
  const balance = outstanding.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const quote = linkedAcceptedQuote(job, input.quotes);
  const notes = job.notes.trim() || client?.notes.trim() || "";

  return {
    jobId: job.id,
    jobStatus: job.status,
    clientId: job.clientId || client?.id || null,
    clientName: job.client,
    address: job.address,
    notes,
    date: job.date,
    time: job.time,
    opsStatus: nextStopOpsStatus(job.status, input.overlay),
    balance,
    balanceLabel: money(balance),
    outstandingCount: outstanding.length,
    quoteId: quote?.id ?? null,
    hasLinkedQuote: Boolean(quote),
  };
}

export function nextStopMessageIntent(
  chip: Extract<NextStopChipId, "on-my-way" | "running-late">,
  brief: Pick<NextStopBrief, "address">,
): string {
  if (chip === "on-my-way") {
    return `I'm on my way to ${brief.address} now.`;
  }
  return `I'm running a bit late to ${brief.address}.`;
}

export function nextStopToolCall(
  chip: NextStopChipId,
  brief: Pick<NextStopBrief, "jobId" | "clientName" | "address" | "hasLinkedQuote">,
  confirm = false,
): NextStopToolCall {
  if (chip === "on-my-way" || chip === "running-late") {
    return {
      name: "draft_client_message",
      args: {
        query: brief.clientName,
        intent: nextStopMessageIntent(chip, brief),
      },
    };
  }
  const args: Record<string, unknown> = {
    jobId: brief.jobId,
    confirm,
  };
  return {
    name: "complete_job_and_draft_invoice",
    args,
  };
}

export function canConfirmDraftInvoice(brief: NextStopBrief | null): boolean {
  return Boolean(brief?.hasLinkedQuote);
}

export function overlayForChip(chip: NextStopChipId): NextStopOpsOverlay | null {
  if (chip === "on-my-way") return "En route";
  if (chip === "running-late") return "Running late";
  if (chip === "done-draft-invoice") return "Done";
  return null;
}

export function formatNextStopToolReply(
  chip: NextStopChipId,
  toolText: string,
  action?: string,
): string {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(toolText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    return toolText;
  }

  if (typeof payload.error === "string") return payload.error;

  if (chip === "on-my-way" || chip === "running-late") {
    const draft = typeof payload.draft === "string" ? payload.draft : "";
    const preferred = typeof payload.preferred === "string" ? payload.preferred : "Message";
    const phone = typeof payload.phone === "string" ? payload.phone : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const contact = phone || email;
    const lines = [draft || "Draft ready.", `${preferred}${contact ? `: ${contact}` : ""}.`, "Not sent."];
    return lines.filter(Boolean).join("\n");
  }

  if (payload.needsConfirm === true && typeof payload.preview === "string") {
    return payload.preview;
  }

  if (action) return action;
  const number = typeof payload.invoiceNumber === "string" ? payload.invoiceNumber : "";
  return number
    ? `Job completed and invoice ${number} drafted from the linked quote.`
    : "Job completed and invoice drafted from the linked quote.";
}

export function localMessageDraft(
  chip: Extract<NextStopChipId, "on-my-way" | "running-late">,
  brief: Pick<NextStopBrief, "clientName" | "address">,
): string {
  return `Hi ${brief.clientName}, ${nextStopMessageIntent(chip, brief)} — Mow & Glow Property Services`;
}

export function nextStopOpsTone(status: NextStopOpsStatus): "olive" | "forest" | "amber" | "sage" | "success" {
  if (status === "En route") return "forest";
  if (status === "Running late") return "amber";
  if (status === "In progress") return "sage";
  if (status === "Done") return "success";
  return "olive";
}
