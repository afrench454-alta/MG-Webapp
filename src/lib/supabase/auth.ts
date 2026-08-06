import "server-only";

import { cache } from "react";

import { createClient } from "./server";

export type AuthenticatedActor = Readonly<{
  id: string;
  email: string | null;
  sessionId: string | null;
}>;

/**
 * Returns a deliberately narrow DTO derived from a cryptographically verified
 * access token. It never trusts the user object from getSession().
 */
export const getAuthenticatedActor = cache(
  async (): Promise<AuthenticatedActor | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    const { claims } = data;

    return Object.freeze({
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      sessionId:
        typeof claims.session_id === "string" ? claims.session_id : null,
    });
  },
);
