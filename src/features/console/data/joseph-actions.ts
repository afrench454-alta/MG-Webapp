"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireBusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import {
  approveJosephRequestSchema,
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
  nextStopToolCall,
} from "./joseph-next-stop";
import { listClients } from "./client-repository";
import { josephMutationName, proposeJosephMutation } from "./joseph-confirmation";
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
        return { ok: true, reply, actions };
      }

      history.push({
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        try {
          const mutation = josephMutationName.safeParse(call.function.name);
          if (mutation.success) {
            const proposal = await proposeJosephMutation(context, mutation.data, call.function.arguments);
            return { ok: true, reply: "Review the proposed change below.", actions: [], proposal };
          }
          const executed = await executeJosephTool(
            context,
            call.function.name,
            call.function.arguments,
          );
          if (executed.action) {
            actions.push(executed.action);
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

  if (parsed.data.chip === "done-draft-invoice" && !canConfirmDraftInvoice(brief)) {
    return { ok: false, message: "This stop has no accepted quote to invoice from." };
  }

  const call = nextStopToolCall(parsed.data.chip, brief);
  try {
    const proposal = await proposeJosephMutation(
      context,
      josephMutationName.parse(call.name),
      JSON.stringify(call.args),
      { chip: parsed.data.chip, quoteId: brief.quoteId },
    );
    return { ok: true, reply: "Review the proposed change below.", actions: [], proposal };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Those details were not valid."
      : error instanceof Error ? error.message : "The action could not be prepared.";
    return { ok: false, message };
  }
}

export async function approveJosephAction(input: unknown): Promise<AskJosephResult> {
  const parsed = approveJosephRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a proposed change to approve." };

  try {
    const context = await requireBusinessContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("approve_joseph_action", {
      target_business_id: context.businessId,
      proposal_token: parsed.data.token,
    });
    if (error) {
      const message = error.code === "P0001"
        ? error.message
        : "Joseph could not apply that change. Review a new proposal and try again.";
      return { ok: false, message };
    }
    const reply = z.string().parse(data);
    revalidatePath("/");
    return { ok: true, reply, actions: [reply] };
  } catch {
    return { ok: false, message: "Joseph could not apply that change." };
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
