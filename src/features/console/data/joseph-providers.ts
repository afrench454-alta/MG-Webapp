export const JOSEPH_NOT_CONNECTED =
  "Joseph is not connected on this deployment yet. Add OPENROUTER_API_KEY in Vercel.";
export const JOSEPH_UNAVAILABLE = "Joseph is briefly unavailable. Try again.";
export const JOSEPH_UNAUTHORIZED =
  "The OpenRouter key was rejected. Check OPENROUTER_API_KEY on this deployment.";
export const JOSEPH_RATE_LIMITED = "Joseph is busy. Try again in a moment.";

export const DEFAULT_JOSEPH_MODEL = "openai/gpt-4o-mini";

export type OpenRouterToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
};

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ChatSuccess = {
  ok: true;
  content: string | null;
  toolCalls: OpenRouterToolCall[];
};

type ChatFailure = {
  ok: false;
  reason: "unauthorized" | "rate_limited" | "unavailable";
};

export async function requestOpenRouterChat(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
  tools: OpenRouterTool[],
  fetchImpl: typeof fetch = fetch,
): Promise<ChatSuccess | ChatFailure> {
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mg-webapp-host.vercel.app",
      "X-Title": "Mow & Glow Joseph",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status === 429) {
    return { ok: false, reason: "rate_limited" };
  }
  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, reason: "unavailable" };
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { ok: false, reason: "unavailable" };
  }
  const first = choices[0];
  if (!first || typeof first !== "object") {
    return { ok: false, reason: "unavailable" };
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    return { ok: false, reason: "unavailable" };
  }

  const contentValue = (message as { content?: unknown }).content;
  const content = typeof contentValue === "string" ? contentValue : null;
  const rawCalls = (message as { tool_calls?: unknown }).tool_calls;
  const toolCalls: OpenRouterToolCall[] = [];
  if (Array.isArray(rawCalls)) {
    for (const call of rawCalls) {
      if (!call || typeof call !== "object") continue;
      const id = (call as { id?: unknown }).id;
      const fn = (call as { function?: unknown }).function;
      if (typeof id !== "string" || !fn || typeof fn !== "object") continue;
      const name = (fn as { name?: unknown }).name;
      const args = (fn as { arguments?: unknown }).arguments;
      if (typeof name !== "string" || typeof args !== "string") continue;
      toolCalls.push({
        id,
        type: "function",
        function: { name, arguments: args },
      });
    }
  }

  return { ok: true, content, toolCalls };
}

export function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function resolveJosephConfig(
  env: Record<string, string | undefined> = process.env,
): {
  apiKey: string;
  model: string;
} | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_JOSEPH_MODEL;
  return { apiKey, model };
}
