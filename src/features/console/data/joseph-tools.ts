import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { money, quoteTotals } from "../domain";
import { listClients } from "./client-repository";
import { invoiceDisplayStatus } from "./invoice-lifecycle";
import { isLiveInvoice } from "./list-filters";
import { draftEstimateFromProvider } from "./estimator-providers";
import {
  listInvoices,
  listJobs,
} from "./operations-repository";
import type { OpenRouterTool } from "./joseph-providers";
import { parseToolArguments } from "./joseph-providers";

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
      description: "List jobs, optionally filtered by client text or status.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
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
      name: "update_job_status",
      description:
        "Propose changing a job status. Technicians may only update assigned jobs.",
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
        "Propose completing a job and creating a draft invoice. Owners and co-owners only.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          rate: { type: "number" },
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
      description: "Propose saving a draft quote against an existing job request.",
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

export async function executeJosephTool(
  context: BusinessContext,
  name: string,
  rawArgs: string,
): Promise<{ text: string; action?: string }> {
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
      const jobs = await listJobs(context);
      const visible =
        context.role === "technician"
          ? jobs.filter((job) => job.assigneeIds.includes(context.actorId))
          : jobs;
      const matches = visible.filter((job) => {
        if (status && job.status !== status) return false;
        if (!query) return true;
        return (
          includesQuery(job.client, query) ||
          includesQuery(job.address, query) ||
          includesQuery(job.displayName, query) ||
          includesQuery(job.category, query)
        );
      });
      return {
        text: JSON.stringify(
          matches.slice(0, 12).map((job) => ({
            id: job.id,
            client: job.client,
            address: job.address,
            status: job.status,
            date: job.date,
            time: job.time,
            category: job.category,
            scope: job.scope,
            notes: job.notes,
          })),
        ),
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
    case "draft_quote_estimate": {
      if (!canManage(context)) return { text: JSON.stringify({ error: "Owners only." }) };
      const brief = z.string().trim().min(8).max(8_000).parse(args.brief);
      const address = z.string().trim().max(400).optional().parse(args.address);
      const estimate = await draftEstimateFromProvider(
        [`Scope:\n${brief}`, address ? `Property: ${address}` : "Property: not supplied"].join("\n"),
      );
      return { text: JSON.stringify(estimate) };
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

export function josephSystemPrompt(role: BusinessContext["role"]): string {
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

Rules:
- Call tools for live data. Do not invent jobs, totals, or phone numbers.
- Changes are proposals. The signed-in user must review and approve using the console. Never claim a proposal has been applied.
- If several jobs match, list them and ask which one.
- Keep replies under 80 words unless listing invoices.`;
}
