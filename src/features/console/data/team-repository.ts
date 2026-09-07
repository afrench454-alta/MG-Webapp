import "server-only";

import { z } from "zod";

import { formatMemberDisplayName } from "@/lib/brand";
import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import {
  businessProfile,
  type BusinessProfile,
  type TeamInvitation,
  type TeamMember,
} from "../domain";
import type {
  BusinessProfileUpdateInput,
  TeamInviteInput,
  TeamInvitePreview,
  TeamMemberUpdateInput,
} from "./team-contract";

const profileRowSchema = z.object({
  id: z.uuid(),
  display_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(["owner", "co_owner", "technician"]),
  is_active: z.boolean(),
});

const invitationRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["co_owner", "technician"]),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  created_at: z.string(),
  expires_at: z.string(),
});

const previewRowSchema = z.object({
  email: z.string(),
  business_name: z.string(),
  member_role: z.enum(["owner", "co_owner", "technician"]),
  expires_at: z.string(),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
});

const businessRowSchema = z.object({
  name: z.string(),
  abn: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date(value));
}

function mapAppRole(
  role: "owner" | "co_owner" | "technician",
): TeamMember["role"] {
  if (role === "co_owner") return "Co-owner";
  if (role === "technician") return "Worker";
  return "Owner";
}

function mapMember(row: z.infer<typeof profileRowSchema>): TeamMember {
  const role = mapAppRole(row.role);
  return {
    id: row.id,
    name: formatMemberDisplayName(row.display_name, row.email, role),
    email: row.email || "",
    role,
    isActive: row.is_active,
  };
}

export async function listTeamMembers(
  context: BusinessContext,
  options: { includeInactive?: boolean } = {},
): Promise<TeamMember[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, display_name, email, role, is_active")
    .eq("business_id", context.businessId)
    .order("display_name");
  if (!options.includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return z.array(profileRowSchema).parse(data || []).map(mapMember);
}

export async function listTeamInvitations(
  context: BusinessContext,
): Promise<TeamInvitation[]> {
  if (context.role === "technician") return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_invitations")
    .select("id, email, role, status, created_at, expires_at")
    .eq("business_id", context.businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    if (/team_invitations|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return z.array(invitationRowSchema).parse(data || []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role === "co_owner" ? "Co-owner" : "Worker",
    status:
      row.status === "accepted"
        ? "Accepted"
        : row.status === "revoked"
          ? "Revoked"
          : row.status === "expired"
            ? "Expired"
            : "Pending",
    created: formatDate(row.created_at),
    expires: formatDate(row.expires_at),
  }));
}

export async function getBusinessProfile(
  context: BusinessContext,
): Promise<BusinessProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("name, abn, email, phone, website")
    .eq("id", context.businessId)
    .single();
  if (error) throw new Error(error.message);
  const business = businessRowSchema.parse(data);

  const settingsResult = await supabase
    .from("business_settings")
    .select("payment_to, bsb, account_number")
    .eq("business_id", context.businessId)
    .maybeSingle();

  const settings = settingsResult.error
    ? null
    : z
        .object({
          payment_to: z.string().nullable().optional(),
          bsb: z.string().nullable().optional(),
          account_number: z.string().nullable().optional(),
        })
        .passthrough()
        .safeParse(settingsResult.data || {});

  return {
    name: business.name || businessProfile.name,
    abn: business.abn || businessProfile.abn,
    email: business.email || businessProfile.email,
    phone: business.phone || businessProfile.phone,
    website: business.website || businessProfile.website,
    paymentTo:
      (settings?.success ? settings.data.payment_to : "") ||
      businessProfile.paymentTo,
    bsb: (settings?.success ? settings.data.bsb : "") || businessProfile.bsb,
    accountNumber:
      (settings?.success ? settings.data.account_number : "") ||
      businessProfile.accountNumber,
  };
}

export async function updateBusinessProfile(
  context: BusinessContext,
  input: BusinessProfileUpdateInput,
): Promise<BusinessProfile> {
  const supabase = await createClient();
  const { error: businessError } = await supabase
    .from("businesses")
    .update({
      name: input.name,
      abn: input.abn || null,
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
    })
    .eq("id", context.businessId);
  if (businessError) throw new Error(businessError.message);

  const { error: settingsError } = await supabase
    .from("business_settings")
    .update({
      payment_to: input.paymentTo || null,
      bsb: input.bsb || null,
      account_number: input.accountNumber || null,
    })
    .eq("business_id", context.businessId);
  if (
    settingsError &&
    !/payment_to|column|schema cache|does not exist/i.test(settingsError.message)
  ) {
    throw new Error(settingsError.message);
  }

  return getBusinessProfile(context);
}

export async function createTeamInvitation(
  context: BusinessContext,
  input: TeamInviteInput,
  rawToken: string,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team_invitation", {
    target_email: input.email,
    target_role: input.role === "Co-owner" ? "co_owner" : "technician",
    raw_token: rawToken,
  });
  if (error) throw new Error(error.message);
  void context;
  return z.uuid().parse(data);
}

export async function revokeTeamInvitation(
  context: BusinessContext,
  invitationId: string,
): Promise<string> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_team_invitation", {
    target_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
  void context;
  return invitationId;
}

export async function previewTeamInvitation(
  rawToken: string,
): Promise<TeamInvitePreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_team_invitation", {
    raw_token: rawToken,
  });
  if (error) {
    if (
      /preview_team_invitation|schema cache|does not exist|function/i.test(
        error.message,
      )
    ) {
      return null;
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const parsed = previewRowSchema.parse(row);
  const expired =
    parsed.status === "pending" &&
    new Date(parsed.expires_at).getTime() <= Date.now();
  return {
    email: parsed.email,
    businessName: parsed.business_name,
    role: parsed.member_role === "co_owner" ? "Co-owner" : "Worker",
    expiresAt: parsed.expires_at,
    status: expired ? "expired" : parsed.status,
  };
}

export async function acceptTeamInvitation(
  rawToken: string,
): Promise<{ businessName: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_team_invitation", {
    raw_token: rawToken,
  });
  if (error) throw new Error(error.message);
  const row = z
    .object({
      business_id: z.uuid(),
      business_name: z.string(),
      member_role: z.enum(["owner", "co_owner", "technician"]),
    })
    .parse(Array.isArray(data) ? data[0] : data);
  return { businessName: row.business_name };
}

export async function updateTeamMember(
  context: BusinessContext,
  input: TeamMemberUpdateInput,
): Promise<TeamMember> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name) {
    patch.display_name = input.name;
  }
  if (input.role) {
    patch.role = input.role === "Co-owner" ? "co_owner" : "technician";
  }
  if (typeof input.isActive === "boolean") {
    patch.is_active = input.isActive;
  }
  if (!Object.keys(patch).length) {
    throw new Error("Nothing to update.");
  }
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("business_id", context.businessId)
    .eq("id", input.profileId)
    .single();
  if (existingError) throw new Error(existingError.message);
  const currentRole = z
    .object({ role: z.enum(["owner", "co_owner", "technician"]) })
    .parse(existing).role;
  if (currentRole === "owner" && (input.role || input.isActive === false)) {
    throw new Error("The owner account cannot be changed from here.");
  }
  if (input.profileId === context.actorId && input.isActive === false) {
    throw new Error("You cannot deactivate your own account.");
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("business_id", context.businessId)
    .eq("id", input.profileId)
    .select("id, display_name, email, role, is_active")
    .single();
  if (error) throw new Error(error.message);
  return mapMember(profileRowSchema.parse(data));
}
