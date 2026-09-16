import { z } from "zod";

export const JOSEPH_WAKE_NAME = "Joseph";

export const JOSEPH_SUGGESTIONS = [
  { label: "What's on today?", prompt: "Which jobs are scheduled today?" },
  { label: "Outstanding invoices", prompt: "What invoices are outstanding?" },
  { label: "Who's on the board?", prompt: "Summarise the job board for me." },
] as const;

export const josephRoleSchema = z.enum(["user", "assistant"]);

export const josephMessageSchema = z.object({
  role: josephRoleSchema,
  content: z.string().trim().min(1).max(8_000),
});

export const askJosephRequestSchema = z.object({
  messages: z.array(josephMessageSchema).min(1).max(24),
});

export const runJosephNextStopRequestSchema = z.object({
  chip: z.enum(["on-my-way", "running-late", "done-draft-invoice"]),
  jobId: z.uuid(),
  confirm: z.boolean().optional(),
});

export type JosephMessage = z.infer<typeof josephMessageSchema>;
export type AskJosephRequest = z.infer<typeof askJosephRequestSchema>;
export type RunJosephNextStopRequest = z.infer<typeof runJosephNextStopRequestSchema>;

export type AskJosephResult =
  | Readonly<{ ok: true; reply: string; actions: string[] }>
  | Readonly<{ ok: false; message: string }>;

export type AskJosephAction = (input: AskJosephRequest) => Promise<AskJosephResult>;
export type RunJosephNextStopAction = (
  input: RunJosephNextStopRequest,
) => Promise<AskJosephResult>;

export function stripJosephWake(raw: string): string {
  return raw
    .replace(/^\s*(hey|ok|okay|hi|g'?day)?\s*joseph[,:\-.]?\s+/i, "")
    .replace(/^\s*joseph[,:\-.]?\s*/i, "")
    .trim();
}
