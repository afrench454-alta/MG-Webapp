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

export type RateChipOption = {
  id: string;
  description: string;
  rate: number;
  quantity: number;
  unitLabel?: string;
  source: "last-quote" | "last-invoice" | "catalog";
  sourceLabel: string;
};

const CATALOG_RATE_CHIPS: RateChipOption[] = [
  {
    id: "cat-general-clean",
    description: "General domestic clean (per hour)",
    rate: 65,
    quantity: 3,
    unitLabel: "hrs",
    source: "catalog",
    sourceLabel: "Standard rate",
  },
  {
    id: "cat-mow-edge",
    description: "Lawn mowing, edging & blow-down",
    rate: 85,
    quantity: 1,
    unitLabel: "ea",
    source: "catalog",
    sourceLabel: "Standard rate",
  },
  {
    id: "cat-yard-maint",
    description: "Garden & property maintenance (per hour)",
    rate: 75,
    quantity: 2,
    unitLabel: "hrs",
    source: "catalog",
    sourceLabel: "Standard rate",
  },
  {
    id: "cat-bond-clean",
    description: "End-of-lease / bond detail clean",
    rate: 380,
    quantity: 1,
    unitLabel: "ea",
    source: "catalog",
    sourceLabel: "Standard rate",
  },
  {
    id: "cat-green-waste",
    description: "Green waste removal & tip fee",
    rate: 45,
    quantity: 1,
    unitLabel: "ea",
    source: "catalog",
    sourceLabel: "Standard rate",
  },
];

export function buildClientRateChips(options: {
  client?: { id?: string; name?: string } | null;
  quotes?: Quote[];
  invoices?: Invoice[];
}): RateChipOption[] {
  const clientId = options.client?.id?.trim();
  const clientName = options.client?.name?.trim().toLowerCase();
  const seen = new Set<string>();
  const chips: RateChipOption[] = [];

  const matchesRecordClient = (rec: { clientId?: string; client: string }) => {
    if (!clientId && !clientName) return false;
    if (clientId && rec.clientId && rec.clientId === clientId) return true;
    if (clientName && rec.client.trim().toLowerCase() === clientName) return true;
    return false;
  };

  for (const quote of options.quotes ?? []) {
    if (quote.status === "Void" || !matchesRecordClient(quote)) continue;
    const docRef = quote.documentNumber || quote.id;
    for (const item of quote.items) {
      const desc = item.description.trim();
      const rate = Number(item.rate);
      if (!desc || !Number.isFinite(rate) || rate <= 0) continue;
      const key = `${desc.toLowerCase()}@${rate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({
        id: `quote-${quote.id}-${chips.length}`,
        description: desc,
        rate,
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unitLabel: item.unitLabel,
        source: "last-quote",
        sourceLabel: `Last quote (${docRef})`,
      });
    }
  }

  for (const inv of options.invoices ?? []) {
    if (inv.documentStatus === "Void" || !matchesRecordClient(inv)) continue;
    const docRef = inv.documentNumber || inv.id;
    for (const item of inv.items) {
      const desc = item.description.trim();
      const rate = Number(item.rate);
      if (!desc || !Number.isFinite(rate) || rate <= 0) continue;
      const key = `${desc.toLowerCase()}@${rate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({
        id: `inv-${inv.id}-${chips.length}`,
        description: desc,
        rate,
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        unitLabel: item.unitLabel,
        source: "last-invoice",
        sourceLabel: `Billed (${docRef})`,
      });
    }
  }

  for (const catalogChip of CATALOG_RATE_CHIPS) {
    const key = `${catalogChip.description.toLowerCase()}@${catalogChip.rate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push(catalogChip);
  }

  return chips.slice(0, 8);
}
