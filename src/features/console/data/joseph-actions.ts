"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";

import {
  askJosephRequestSchema,
  runJosephNextStopRequestSchema,
  type AskJosephResult,
  type JosephMessage,
} from "./joseph-contract";
import {
  JOSEPH_NOT_CONNECTED,
  JOSEPH_RATE_LIMITED,
  JOSEPH_UNAUTHORIZED,
  JOSEPH_UNAVAILABLE,
  requestOpenRouterChat,
  resolveJosephConfig,
  type OpenRouterMessage,
} from "./joseph-providers";
import {
  JOSEPH_TOOL_DEFINITIONS,
  executeJosephTool,
  josephSystemPrompt,
} from "./joseph-tools";
import {
  buildNextStopBrief,
  canConfirmDraftInvoice,
  formatNextStopToolReply,
  nextStopToolCall,
} from "./joseph-next-stop";
import { listClients } from "./client-repository";
import { listInvoices, listJobs, listQuotes } from "./operations-repository";

const MAX_TOOL_ROUNDS = 4;

export async function askJosephAction(input: unknown): Promise<AskJosephResult> {
  const parsed = askJosephRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Ask Joseph a short question first." };
  }

  let context;
  try {
    context = await requireBusinessContext();
  } catch {
    return { ok: false, message: "Sign in to talk to Joseph." };
  }

  const config = resolveJosephConfig();
  if (!config) {
    return { ok: false, message: JOSEPH_NOT_CONNECTED };
  }

  const history: OpenRouterMessage[] = [
    { role: "system", content: josephSystemPrompt(context.role) },
    ...parsed.data.messages.map((message: JosephMessage) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const actions: string[] = [];
  let mutated = false;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await requestOpenRouterChat(
        config.apiKey,
        config.model,
        history,
        JOSEPH_TOOL_DEFINITIONS,
      );
      if (!result.ok) {
        if (result.reason === "unauthorized") {
          return { ok: false, message: JOSEPH_UNAUTHORIZED };
        }
        if (result.reason === "rate_limited") {
          return { ok: false, message: JOSEPH_RATE_LIMITED };
        }
        return { ok: false, message: JOSEPH_UNAVAILABLE };
      }

      if (result.toolCalls.length === 0) {
        const reply = result.content?.trim();
        if (!reply) {
          return { ok: false, message: JOSEPH_UNAVAILABLE };
        }
        if (mutated) revalidatePath("/");
        return { ok: true, reply, actions };
      }

      history.push({
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        try {
          const executed = await executeJosephTool(
            context,
            call.function.name,
            call.function.arguments,
          );
          if (executed.action) {
            actions.push(executed.action);
            mutated = true;
          }
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: executed.text,
          });
        } catch (error) {
          const message =
            error instanceof z.ZodError
              ? "Those details were not valid."
              : error instanceof Error
                ? error.message
                : "The action failed.";
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
    }
  } catch (error) {
    console.error("Joseph failed", error);
    return { ok: false, message: "Joseph could not finish that request." };
  }

  if (mutated) revalidatePath("/");
  return {
    ok: false,
    message: "Joseph needed too many steps. Try a shorter request.",
  };
}

export async function runJosephNextStopAction(input: unknown): Promise<AskJosephResult> {
  const parsed = runJosephNextStopRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Pick a next-stop action first." };
  }

  let context;
  try {
    context = await requireBusinessContext();
  } catch {
    return { ok: false, message: "Sign in to talk to Joseph." };
  }

  const [jobs, clients, invoices, quotes] = await Promise.all([
    listJobs(context),
    listClients(context),
    listInvoices(context),
    listQuotes(context),
  ]);
  const brief = buildNextStopBrief({
    jobs,
    clients,
    invoices,
    quotes,
    actorId: context.actorId,
    actorRole: context.role,
  });
  if (!brief || brief.jobId !== parsed.data.jobId) {
    return { ok: false, message: "That next stop is no longer current." };
  }

  if (parsed.data.chip === "done-draft-invoice") {
    if (!canConfirmDraftInvoice(brief)) {
      return { ok: false, message: "This stop has no accepted quote to invoice from." };
    }
    if (!parsed.data.confirm) {
      return {
        ok: true,
        reply: `Complete ${brief.clientName} at ${brief.address} and draft the invoice from the linked quote.`,
        actions: [],
      };
    }
  }

  const call = nextStopToolCall(parsed.data.chip, brief, parsed.data.confirm === true);
  try {
    const executed = await executeJosephTool(context, call.name, JSON.stringify(call.args));
    if (executed.action) revalidatePath("/");
    return {
      ok: true,
      reply: formatNextStopToolReply(parsed.data.chip, executed.text, executed.action),
      actions: executed.action ? [executed.action] : [],
    };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Those details were not valid."
        : error instanceof Error
          ? error.message
          : "The action failed.";
    return { ok: false, message };
  }
}


export async function getJosephNextStopBriefAction(): Promise<{
  ok: true;
  jobs: Awaited<ReturnType<typeof listJobs>>;
  clients: Awaited<ReturnType<typeof listClients>>;
  invoices: Awaited<ReturnType<typeof listInvoices>>;
  quotes: Awaited<ReturnType<typeof listQuotes>>;
  actorId: string;
  actorRole: "owner" | "co_owner" | "technician";
} | { ok: false; message: string }> {
  let context;
  try {
    context = await requireBusinessContext();
  } catch {
    return { ok: false, message: "Sign in to talk to Joseph." };
  }

  const [jobs, clients, invoices, quotes] = await Promise.all([
    listJobs(context),
    listClients(context),
    listInvoices(context),
    listQuotes(context),
  ]);

  return {
    ok: true,
    jobs,
    clients,
    invoices,
    quotes,
    actorId: context.actorId,
    actorRole: context.role,
  };
}
