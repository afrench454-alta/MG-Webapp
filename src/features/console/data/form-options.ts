import type { Client, Invoice, Job, JobRequest, LineItem, Quote } from "../domain";

const CLIENT_STATUS_RANK: Record<Client["status"], number> = {
  Active: 0,
  Lead: 1,
  Inactive: 2,
};

const JOB_STATUS_RANK: Record<Job["status"], number> = {
  completed: 0,
  "in-progress": 1,
  scheduled: 2,
  "on-hold": 3,
  unscheduled: 4,
  cancelled: 5,
};

export function rankedClients(clients: Client[]): Client[] {
  return [...clients].sort((left, right) => {
    const byStatus =
      CLIENT_STATUS_RANK[left.status] - CLIENT_STATUS_RANK[right.status];
    if (byStatus !== 0) return byStatus;
    return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
  });
}

export function matchesClientJob(job: Job, client?: Client): boolean {
  if (!client) return true;
  if (job.clientId && job.clientId === client.id) return true;
  return job.client.trim().toLowerCase() === client.name.trim().toLowerCase();
}

export function liveInvoicedJobIds(
  invoices: Invoice[],
  keepJobId?: string,
): Set<string> {
  const ids = new Set<string>();
  for (const invoice of invoices) {
    if (!invoice.jobId) continue;
    if (keepJobId && invoice.jobId === keepJobId) continue;
    if (invoice.documentStatus === "Void") continue;
    ids.add(invoice.jobId);
  }
  return ids;
}

export function invoicePrefillJobs(options: {
  jobs: Job[];
  invoices?: Invoice[];
  client?: Client;
  selectedJobId?: string;
}): Job[] {
  const invoiced = liveInvoicedJobIds(
    options.invoices ?? [],
    options.selectedJobId,
  );
  return options.jobs
    .filter((job) => {
      if (options.selectedJobId && job.id === options.selectedJobId) return true;
      if (job.status === "cancelled") return false;
      if (invoiced.has(job.id)) return false;
      return matchesClientJob(job, options.client);
    })
    .sort((left, right) => {
      const byStatus =
        JOB_STATUS_RANK[left.status] - JOB_STATUS_RANK[right.status];
      if (byStatus !== 0) return byStatus;
      return right.dateKey.localeCompare(left.dateKey);
    });
}

export function quoteableRequests(options: {
  requests: JobRequest[];
  quotes?: Quote[];
  selectedRequestId?: string;
}): JobRequest[] {
  const taken = new Set(
    (options.quotes ?? [])
      .filter(
        (quote) =>
          quote.jobRequestId &&
          quote.status !== "Void" &&
          quote.status !== "Declined" &&
          quote.status !== "Expired",
      )
      .map((quote) => quote.jobRequestId as string),
  );
  return options.requests.filter((request) => {
    if (options.selectedRequestId && request.id === options.selectedRequestId) {
      return true;
    }
    if (
      request.status === "Closed" ||
      request.status === "Rejected" ||
      request.status === "Scheduled"
    ) {
      return false;
    }
    return !taken.has(request.id);
  });
}

export function schedulableRequests(requests: JobRequest[]): JobRequest[] {
  return requests.filter(
    (request) =>
      request.status !== "Scheduled" &&
      request.status !== "Closed" &&
      request.status !== "Rejected",
  );
}

export function scopeLinesFromText(
  text: string | null | undefined,
  fallbackItems: LineItem[] = [],
): string[] {
  const lines = (text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length) return lines;
  return fallbackItems
    .map((item) => item.description.trim())
    .filter(Boolean);
}

export function scopeTextFromInvoice(
  invoice: Pick<Invoice, "scope" | "items">,
): string {
  if (invoice.scope?.length) return invoice.scope.join("\n");
  return "";
}
