"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAuthenticatedActor } from "@/lib/supabase/auth";
import { requireBusinessContext } from "@/lib/supabase/business";

import {
  acceptTeamInvitation,
  createTeamInvitation,
  revokeTeamInvitation,
  updateBusinessProfile,
  updateTeamMember,
} from "./team-repository";
import {
  businessProfileUpdateSchema,
  teamInviteSchema,
  teamMemberUpdateSchema,
  type AcceptInviteResult,
  type BusinessProfileActionResult,
  type InviteTeamResult,
  type RevokeInviteResult,
  type TeamMemberActionResult,
} from "./team-contract";

function failure(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return "Check the details and try again.";
  if (error instanceof Error) {
    if (/permission|owner|co-owner|authentication/i.test(error.message)) {
      return "You do not have permission to make this change.";
    }
    const cleaned = error.message
      .replace(/^.*error:\s*/i, "")
      .split("\n")[0]
      ?.trim();
    if (
      cleaned &&
      cleaned.length < 240 &&
      !/jwt|row-level|rls policy|schema cache/i.test(cleaned)
    ) {
      return cleaned;
    }
  }
  return fallback;
}

const manager = () => requireBusinessContext(["owner", "co_owner"]);

export async function inviteTeamMemberAction(
  input: unknown,
): Promise<InviteTeamResult> {
  const parsed = teamInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and role." };
  }
  try {
    const token = randomBytes(32).toString("base64url");
    const id = await createTeamInvitation(await manager(), parsed.data, token);
    revalidatePath("/");
    return {
      ok: true,
      id,
      path: `/join/${token}`,
      email: parsed.data.email,
      role: parsed.data.role,
    };
  } catch (error) {
    console.error("Team invite failed", error);
    return {
      ok: false,
      message: failure(
        error,
        "The invite could not be created. The latest database update may still need applying.",
      ),
    };
  }
}

export async function revokeTeamInviteAction(
  id: string,
): Promise<RevokeInviteResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "The invite is invalid." };
  try {
    const revokedId = await revokeTeamInvitation(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, id: revokedId };
  } catch (error) {
    return { ok: false, message: failure(error, "The invite could not be revoked.") };
  }
}

export async function updateTeamMemberAction(
  input: unknown,
): Promise<TeamMemberActionResult> {
  const parsed = teamMemberUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "The team member update was invalid." };
  }
  try {
    const member = await updateTeamMember(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, member };
  } catch (error) {
    return {
      ok: false,
      message: failure(error, "The team member could not be updated."),
    };
  }
}

export async function updateBusinessProfileAction(
  input: unknown,
): Promise<BusinessProfileActionResult> {
  const parsed = businessProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the business details and try again." };
  }
  try {
    const profile = await updateBusinessProfile(await manager(), parsed.data);
    revalidatePath("/");
    return { ok: true, profile };
  } catch (error) {
    return {
      ok: false,
      message: failure(error, "Business details could not be saved."),
    };
  }
}

export async function acceptTeamInviteAction(
  token: string,
): Promise<AcceptInviteResult> {
  const parsed = z.string().min(32).max(512).safeParse(token);
  if (!parsed.success) {
    return { ok: false, message: "This invite link is invalid." };
  }
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) return { ok: false, message: "Sign in to accept this invite." };
    const result = await acceptTeamInvitation(parsed.data);
    revalidatePath("/");
    return { ok: true, businessName: result.businessName };
  } catch (error) {
    return {
      ok: false,
      message: failure(error, "This invite could not be accepted."),
    };
  }
}
