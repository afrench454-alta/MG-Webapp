import "server-only";

import { cache } from "react";
import { z } from "zod";

import { getAuthenticatedActor } from "./auth";
import { createClient } from "./server";

const appRoleSchema = z.enum(["owner", "co_owner", "technician"]);

const businessContextSchema = z.object({
  business_id: z.uuid(),
  business_name: z.string().min(1).max(160),
  member_role: appRoleSchema,
});

export type AppRole = z.infer<typeof appRoleSchema>;

export type BusinessContext = Readonly<{
  actorId: string;
  actorEmail: string | null;
  businessId: string;
  businessName: string;
  role: AppRole;
}>;

function defaultBusinessName(email: string | null): string {
  const configured = process.env.FIELDCENTRAL_DEFAULT_BUSINESS_NAME?.trim();
  if (configured) return configured.slice(0, 160);

  const accountName = email?.split("@", 1)[0]?.replace(/[._-]+/g, " ").trim();
  if (!accountName) return "My Field Service Business";

  return `${accountName.replace(/\b\w/g, (letter) => letter.toUpperCase())} Field Service`.slice(
    0,
    160,
  );
}

/**
 * Resolves the secure database-backed membership for the current request.
 * The bootstrap RPC is idempotent and only creates a business for a user who
 * does not already have an active membership.
 */
export const getBusinessContext = cache(
  async (): Promise<BusinessContext | null> => {
    const actor = await getAuthenticatedActor();
    if (!actor) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "bootstrap_current_user_business",
      { desired_name: defaultBusinessName(actor.email) },
    );

    if (error) {
      throw new Error(`Unable to resolve the FieldCentral business: ${error.message}`);
    }

    const row = businessContextSchema.parse(Array.isArray(data) ? data[0] : data);

    return Object.freeze({
      actorId: actor.id,
      actorEmail: actor.email,
      businessId: row.business_id,
      businessName: row.business_name,
      role: row.member_role,
    });
  },
);

export async function requireBusinessContext(
  allowedRoles?: readonly AppRole[],
): Promise<BusinessContext> {
  const context = await getBusinessContext();

  if (!context) {
    throw new Error("Authentication required.");
  }

  if (allowedRoles && !allowedRoles.includes(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }

  return context;
}
