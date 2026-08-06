export type SupabasePublicEnv = Readonly<{
  url: string;
  publishableKey: string;
}>;

const SUPABASE_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function readSupabasePublicEnv(): SupabasePublicEnv | null {
  // Direct property access is required so Next.js can inline public values in
  // browser bundles. Never add server-only keys to this client-safe module.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) {
    return null;
  }

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError(
      `Supabase configuration is incomplete. Set both ${SUPABASE_ENV_NAMES.join(
        " and ",
      )}.`,
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.",
    );
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new SupabaseConfigurationError(
      "NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS.",
    );
  }

  if (publishableKey.length < 20 || /\s/.test(publishableKey)) {
    throw new SupabaseConfigurationError(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not in a valid format.",
    );
  }

  return Object.freeze({
    url: parsedUrl.toString().replace(/\/$/, ""),
    publishableKey,
  });
}

/**
 * Returns false only when both public variables are intentionally absent.
 * Partial or malformed configuration always fails loudly.
 */
export function isSupabaseConfigured(): boolean {
  return readSupabasePublicEnv() !== null;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const env = readSupabasePublicEnv();

  if (!env) {
    throw new SupabaseConfigurationError(
      `Supabase is not configured. Set ${SUPABASE_ENV_NAMES.join(" and ")}.`,
    );
  }

  return env;
}

