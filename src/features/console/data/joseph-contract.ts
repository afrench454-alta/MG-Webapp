import { z } from "zod";

export const JOSEPH_WAKE_NAME = "Joseph";

export const JOSEPH_SUGGESTIONS = [
  { label: "What's on today?", prompt: "Which jobs are scheduled today?" },
  { label: "Outstanding invoices", prompt: "What invoices are outstanding?" },
  { label: "Who's on the board?", prompt: "Summarise the job board for me." },
] as const;

export const JOSEPH_CONFIRMABLE_TOOLS = [
  "update_job_status",
  "complete_job_and_draft_invoice",
  "create_quote_from_request",
] as const;

export const josephRoleSchema = z.enum(["user", "assistant"]);

export const josephMessageSchema = z.object({
  role: josephRoleSchema,
  content: z.string().trim().min(1).max(8_000),
});

export const josephConfirmToolSchema = z.object({
  name: z.enum(JOSEPH_CONFIRMABLE_TOOLS),
  arguments: z.string().trim().min(2).max(20_000),
  preview: z.string().trim().min(1).max(500),
});

export const askJosephRequestSchema = z.object({
  messages: z.array(josephMessageSchema).min(1).max(24),
  confirmedTool: josephConfirmToolSchema.optional(),
});

export type JosephMessage = z.infer<typeof josephMessageSchema>;
export type JosephConfirmTool = z.infer<typeof josephConfirmToolSchema>;
export type AskJosephRequest = z.infer<typeof askJosephRequestSchema>;

export type AskJosephResult =
  | Readonly<{
      ok: true;
      reply: string;
      actions: string[];
      confirm?: JosephConfirmTool;
    }>
  | Readonly<{ ok: false; message: string }>;

export type AskJosephAction = (input: AskJosephRequest) => Promise<AskJosephResult>;

export function stripJosephWake(raw: string): string {
  return raw
    .replace(/^\s*(hey|ok|okay|hi|g'?day)?\s*joseph[,:\-.]?\s+/i, "")
    .replace(/^\s*joseph[,:\-.]?\s*/i, "")
    .trim();
}

export function argumentsWithConfirm(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return JSON.stringify({ confirm: true });
    }
    return JSON.stringify({ ...(parsed as Record<string, unknown>), confirm: true });
  } catch {
    return JSON.stringify({ confirm: true });
  }
}
