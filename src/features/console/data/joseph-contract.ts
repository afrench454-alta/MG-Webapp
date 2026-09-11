import { z } from "zod";

export const JOSEPH_WAKE_NAME = "Joseph";

export const josephRoleSchema = z.enum(["user", "assistant"]);

export const josephMessageSchema = z.object({
  role: josephRoleSchema,
  content: z.string().trim().min(1).max(8_000),
});

export const askJosephRequestSchema = z.object({
  messages: z.array(josephMessageSchema).min(1).max(24),
});

export type JosephMessage = z.infer<typeof josephMessageSchema>;
export type AskJosephRequest = z.infer<typeof askJosephRequestSchema>;

export type AskJosephResult =
  | Readonly<{ ok: true; reply: string; actions: string[] }>
  | Readonly<{ ok: false; message: string }>;

export type AskJosephAction = (input: AskJosephRequest) => Promise<AskJosephResult>;

export function stripJosephWake(raw: string): string {
  return raw
    .replace(/^\s*(hey|ok|okay|hi|g'?day)?\s*joseph[,:\-.]?\s+/i, "")
    .replace(/^\s*joseph[,:\-.]?\s*/i, "")
    .trim();
}
