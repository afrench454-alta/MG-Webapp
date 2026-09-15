import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { invoiceTerms, money, quoteTotals, type Job, type JobStatus } from "../domain";
import { listClients } from "./client-repository";
import { invoiceDisplayStatus } from "./invoice-lifecycle";
import { isLiveInvoice } from "./list-filters";
import { draftEstimateFromProvider } from "./estimator-providers";
import {
  brisbaneToday,
  formatJosephSnapshot,
  jobOnIsoDate,
  lastAcceptedQuoteBrief,
  pendingWrite,
  type JosephToolResult,
} from "./joseph-ops";
import {
  createInvoice,
  createQuote,
  listInvoices,
  listJobs,
  listQuotes,
  updateJob,
} from "./operations-repository";
import { listJobRequests } from "./job-request-repository";
import type { OpenRouterTool } from "./joseph-providers";
import { parseToolArguments } from "./joseph-providers";

const confirmSchema = z.object({
  confirm: z.boolean().optional(),
});

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const jobStatusSchema = z.enum([
  "unscheduled",
  "scheduled",
  "in-progress",
  "on-hold",
  "completed",
  "cancelled",
]);

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function includesQuery(haystack: string, query: string): boolean {
  const needle = norm(query);
  if (!needle) return true;
  return norm(haystack).includes(needle);
}

function canManage(context: BusinessContext): boolean {
  return context.role === "owner" || context.role === "co_owner";
}

const recurrenceValues = [
  "One-off",
  "Weekly",
  "Fortnightly",
  "Four-weekly",
  "Monthly",
] as const;

type JobRecurrence = (typeof recurrenceValues)[number];

function jobRecurrence(value: string): JobRecurrence {
  return recurrenceValues.find((item) => item === value) ?? "One-off";
}

export type { JosephToolResult } from "./joseph-ops";
export { josephSystemPrompt } from "./joseph-ops";

function jobsVisibleTo(context: BusinessContext, jobs: Job[]): Job[] {
  if (context.role === "technician") {
    return jobs.filter((job) => job.assigneeIds.includes(context.actorId));
  }
  return jobs;
}

export async function buildJosephSnapshot(context: BusinessContext): Promise<string> {
  const today = brisbaneToday();
  const jobs = jobsVisibleTo(context, await listJobs(context)).filter(
    (job) => jobOnIsoDate(job, today) && job.status !== "cancelled",
  );
  let overdueCount: number | null = null;
  if (canManage(context)) {
    const invoices = await listInvoices(context);
    overdueCount = invoices.filter((invoice) => {
      if (!isLiveInvoice(invoice)) return false;
      return invoiceDisplayStatus(invoice) === "Overdue";
    }).length;
  }
  return formatJosephSnapshot({
    today,
    jobs: jobs.slice(0, 12),
    overdueCount,
  });
}

export const JOSEPH_TOOL_DEFINITIONS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Find clients by name, phone, email, or suburb.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List jobs, optionally filtered by client text, status, or calendar date (YYYY-MM-DD, Australia/Brisbane).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD in Australia/Brisbane" },
          status: {
            type: "string",
            enum: [
              "unscheduled",
              "scheduled",
              "in-progress",
              "on-hold",
              "completed",
              "cancelled",
            ],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "today_board",
      description:
        "Read-only run sheet for today (Australia/Brisbane): today's jobs for this user, plus overdue invoice count for owners.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_job_status",
      description:
        "Change a job status. Requires confirm=true. Technicians may only update assigned jobs.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          status: {
            type: "string",
            enum: [
              "unscheduled",
              "scheduled",
              "in-progress",
              "on-hold",
              "completed",
              "cancelled",
            ],
          },
          notes: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["jobId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_outstanding_invoices",
      description: "List unpaid or overdue live invoices. Owners and co-owners only.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_job_and_draft_invoice",
      description:
        "Mark a job completed and create a draft invoice. Requires confirm=true. Owners and co-owners only.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          rate: { type: "number" },
          confirm: { type: "boolean" },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_quote_estimate",
      description:
        "Draft quote line items from a spoken or typed brief. Does not save until create_quote_from_request.",
      parameters: {
        type: "object",
        properties: {
          brief: { type: "string" },
          address: { type: "string" },
        },
        required: ["brief"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quote_from_request",
      description: "Save a draft quote against an existing job request. Requires confirm=true.",
      parameters: {
        type: "object",
        properties: {
          jobRequestId: { type: "string" },
          scope: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unitLabel: { type: "string" },
                rate: { type: "number" },
              },
              required: ["description", "quantity", "rate"],
            },
          },
          confirm: { type: "boolean" },
        },
        required: ["jobRequestId", "scope", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_client_message",
      description:
        "Draft an SMS or email to a client. Does not send. Returns contact details and a message body.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          intent: { type: "string" },
        },
        required: ["query", "intent"],
      },
    },
  },
];

function serializeJobs(jobs: Job[]) {
  return jobs.slice(0, 12).map((job) => ({
    id: job.id,
    client: job.client,
    address: job.address,
    status: job.status,
    date: job.date,
    time: job.time,
    category: job.category,
    scope: job.scope,
    notes: job.notes,
  }));
}

export async function executeJosephTool(
  context: BusinessContext,
  name: string,
  rawArgs: string,
): Promise<JosephToolResult> {
  const args = parseToolArguments(rawArgs);
  switch (name) {
    case "search_clients": {
      const query = z.string().trim().min(1).max(200).parse(args.query);
      const clients = await listClients(context);
      const matches = clients.filter(
        (client) =>
          includesQuery(client.name, query) ||
          includesQuery(client.email, query) ||
          includesQuery(client.phone, query) ||
          client.properties.some(
            (property) =>
              includesQuery(property.address, query) || includesQuery(property.name, query),
          ),
      );
      return {
        text: JSON.stringify(
          matches.slice(0, 8).map((client) => ({
            id: client.id,
            name: client.name,
            phone: client.phone,
            email: client.email,
            preferred: client.preferred,
            notes: client.notes,
            properties: client.properties.map((property) => ({
              id: property.id,
              name: property.name,
              address: property.address,
            })),
          })),
        ),
      };
    }
    case "list_jobs": {
      const query = z.string().trim().max(200).optional().parse(args.query);
      const status = jobStatusSchema.optional().parse(args.status);
      const date = isoDateSchema.optional().parse(args.date);
      const jobs = jobsVisibleTo(context, await listJobs(context));
      const matches = jobs.filter((job) => {
        if (status && job.status !== status) return false;
        if (date && !jobOnIsoDate(job, date)) return false;
        if (!query) return true;
        return (
          includesQuery(job.client, query) ||
          includesQuery(job.address, query) ||
          includesQuery(job.displayName, query) ||
          includesQuery(job.category, query)
        );
      });
      return { text: JSON.stringify(serializeJobs(matches)) };
    }
    case "today_board": {
      const today = brisbaneToday();
      const jobs = jobsVisibleTo(context, await listJobs(context)).filter(
        (job) => jobOnIsoDate(job, today) && job.status !== "cancelled",
      );
      let overdueCount: number | null = null;
      if (canManage(context)) {
        const invoices = await listInvoices(context);
        overdueCount = invoices.filter((invoice) => {
          if (!isLiveInvoice(invoice)) return false;
          return invoiceDisplayStatus(invoice) === "Overdue";
        }).length;
      }
      return {
        text: JSON.stringify({
          today,
          timezone: "Australia/Brisbane",
          jobs: serializeJobs(jobs),
          overdueInvoices: overdueCount,
        }),
      };
    }
    case "update_job_status": {
      const parsed = confirmSchema
        .extend({
          jobId: z.uuid(),
          status: jobStatusSchema,
          notes: z.string().trim().max(20_000).optional(),
        })
        .parse(args);
      if (!parsed.confirm) {
        return pendingWrite("update_job_status", parsed, `Set job ${parsed.jobId} to ${parsed.status}.`);
      }
      const jobs = await listJobs(context, parsed.jobId);
      const job = jobs[0];
      if (!job) throw new Error("Job not found.");
      const { job: updated } = await updateJob(context, {
        id: job.id,
        status: parsed.status as JobStatus,
        notes: parsed.notes ?? job.notes,
        recurrence: jobRecurrence(job.recurrence),
      });
      return {
        text: JSON.stringify({ id: updated.id, client: updated.client, status: updated.status }),
        action: `Marked ${updated.client} as ${updated.status}.`,
      };
    }
    case "list_outstanding_invoices": {
      if (!canManage(context)) return { text: JSON.stringify({ error: "Owners only." }) };
      const invoices = await listInvoices(context);
      const outstanding = invoices.filter((invoice) => {
        if (!isLiveInvoice(invoice)) return false;
        const display = invoiceDisplayStatus(invoice);
        return display !== "Paid" && display !== "Refunded" && display !== "Void";
      });
      return {
        text: JSON.stringify(
          outstanding.slice(0, 20).map((invoice) => ({
            id: invoice.id,
            number: invoice.documentNumber || invoice.id,
            client: invoice.client,
            documentStatus: invoice.documentStatus,
            paymentStatus: invoice.paymentStatus,
            display: invoiceDisplayStatus(invoice),
            due: invoice.due,
            total: money(quoteTotals(invoice.items, invoice.discount ?? 0, invoice.taxRate ?? 0).total),
          })),
        ),
      };
    }
    case "complete_job_and_draft_invoice": {
      if (!canManage(context)) return { text: JSON.stringify({ error: "Owners only." }) };
      const parsed = confirmSchema
        .extend({
          jobId: z.uuid(),
          rate: z.coerce.number().min(0).max(10_000_000).optional(),
        })
        .parse(args);
      const jobs = await listJobs(context, parsed.jobId);
      const job = jobs[0];
      if (!job) throw new Error("Job not found.");
      if (!job.clientId || !job.serviceAddressId) {
        throw new Error("This job is missing a client or property, so an invoice cannot be drafted.");
      }
      const quotes = await listQuotes(context);
      const requestQuotes = job.jobRequestId
        ? quotes.filter(
            (quote) => quote.jobRequestId === job.jobRequestId && quote.status === "Accepted",
          )
        : [];
      const propertyQuote = lastAcceptedQuoteBrief(quotes, {
        propertyId: job.serviceAddressId,
        clientId: job.clientId,
        address: job.address,
      });
      const sourceItems =
        requestQuotes[0]?.items && requestQuotes[0].items.length > 0
          ? requestQuotes[0].items
          : [
              {
                description: job.scope || job.category || "Completed works",
                quantity: 1,
                unitLabel: "ea",
                rate: parsed.rate ?? 0,
              },
            ];
      if (sourceItems.every((item) => Number(item.rate) <= 0) && parsed.rate == null) {
        return {
          text: JSON.stringify({
            needsRate: true,
            preview: `Need a rate to invoice ${job.client} for ${job.category}.`,
            lastAcceptedQuote: propertyQuote,
          }),
        };
      }
      if (!parsed.confirm) {
        return pendingWrite(
          "complete_job_and_draft_invoice",
          parsed,
          `Complete ${job.client} at ${job.address} and draft an invoice.`,
        );
      }
      const { job: updated } = await updateJob(context, {
        id: job.id,
        status: "completed",
        notes: job.notes,
        recurrence: jobRecurrence(job.recurrence),
      });
      const items =
        parsed.rate != null && (!requestQuotes[0] || requestQuotes[0].items.length === 0)
          ? [{ description: job.scope || job.category, quantity: 1, rate: parsed.rate }]
          : sourceItems.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitLabel: item.unitLabel,
              rate: Number(item.rate),
            }));
      const invoice = await createInvoice(context, {
        clientId: job.clientId,
        propertyId: job.serviceAddressId,
        jobId: job.id,
        quoteId: requestQuotes[0]?.id,
        items,
        dueDays: 7,
        notes: invoiceTerms,
      });
      return {
        text: JSON.stringify({
          jobId: updated.id,
          jobStatus: updated.status,
          invoiceId: invoice.id,
          invoiceNumber: invoice.documentNumber,
          total: money(quoteTotals(invoice.items).total),
        }),
        action: `Completed ${job.client} and drafted invoice ${invoice.documentNumber || invoice.id}.`,
      };
    }
    case "draft_quote_estimate": {
      if (!canManage(context)) return { text: JSON.stringify({ error: "Owners only." }) };
      const brief = z.string().trim().min(8).max(8_000).parse(args.brief);
      const address = z.string().trim().max(400).optional().parse(args.address);
      const quotes = await listQuotes(context);
      const prior = lastAcceptedQuoteBrief(quotes, { address });
      const estimate = await draftEstimateFromProvider(
        [
          `Scope:\n${brief}`,
          address ? `Property: ${address}` : "Property: not supplied",
          prior ? `\nUse these rates unless the brief clearly changes them:\n${prior}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return { text: JSON.stringify({ estimate, lastAcceptedQuote: prior }) };
    }
    case "create_quote_from_request": {
      if (!canManage(context)) return { text: JSON.stringify({ error: "Owners only." }) };
      const parsed = confirmSchema
        .extend({
          jobRequestId: z.uuid(),
          scope: z.string().trim().min(1).max(20_000),
          items: z
            .array(
              z.object({
                description: z.string().trim().min(1).max(1_000),
                quantity: z.coerce.number().positive().max(100_000),
                unitLabel: z.string().trim().max(32).optional(),
                rate: z.coerce.number().min(0).max(10_000_000),
              }),
            )
            .min(1)
            .max(100),
        })
        .parse(args);
      const requests = await listJobRequests(context);
      const request = requests.find((item) => item.id === parsed.jobRequestId);
      if (!request) throw new Error("Job request not found.");
      if (!parsed.confirm) {
        return pendingWrite(
          "create_quote_from_request",
          parsed,
          `Save draft quote for ${request.client}: ${parsed.scope}`,
        );
      }
      const quote = await createQuote(context, {
        jobRequestId: parsed.jobRequestId,
        scope: parsed.scope,
        items: parsed.items,
        clientNotes: "",
        internalNotes: "Drafted by Joseph",
      });
      return {
        text: JSON.stringify({
          id: quote.id,
          number: quote.documentNumber,
          client: quote.client,
          total: money(quoteTotals(quote.items).total),
        }),
        action: `Drafted quote ${quote.documentNumber || quote.id} for ${quote.client}.`,
      };
    }
    case "draft_client_message": {
      const query = z.string().trim().min(1).max(200).parse(args.query);
      const intent = z.string().trim().min(1).max(2_000).parse(args.intent);
      const clients = await listClients(context);
      const client = clients.find(
        (item) =>
          includesQuery(item.name, query) ||
          includesQuery(item.email, query) ||
          includesQuery(item.phone, query),
      );
      if (!client) return { text: JSON.stringify({ error: "No matching client." }) };
      const body = `Hi ${client.name}, ${intent.replace(/\s+/g, " ").trim()} — Mow & Glow Property Services`;
      return {
        text: JSON.stringify({
          client: client.name,
          preferred: client.preferred,
          phone: client.phone,
          email: client.email,
          smsLink: client.phone ? `sms:${client.phone}?body=${encodeURIComponent(body)}` : null,
          mailto: client.email
            ? `mailto:${client.email}?subject=${encodeURIComponent("Mow & Glow")}&body=${encodeURIComponent(body)}`
            : null,
          draft: body,
          sent: false,
        }),
        action: `Drafted a ${client.preferred.toLowerCase()} to ${client.name}. Not sent.`,
      };
    }
    default:
      return { text: JSON.stringify({ error: `Unknown tool ${name}` }) };
  }
}
