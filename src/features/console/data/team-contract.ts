import { z } from "zod";

import type { BusinessProfile, TeamInvitation, TeamMember } from "../domain";

export const teamInviteSchema = z.object({
  email: z.email().max(320),
  role: z.enum(["Co-owner", "Technician"]),
});

export const teamMemberUpdateSchema = z.object({
  profileId: z.uuid(),
  role: z.enum(["Co-owner", "Technician"]).optional(),
  isActive: z.boolean().optional(),
});

export const businessProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  abn: z.string().trim().max(20).optional().default(""),
  email: z.union([z.literal(""), z.email().max(320)]),
  phone: z.string().trim().max(80).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
  paymentTo: z.string().trim().max(160).optional().default(""),
  bsb: z.string().trim().max(20).optional().default(""),
  accountNumber: z.string().trim().max(20).optional().default(""),
});

export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
export type TeamMemberUpdateInput = z.infer<typeof teamMemberUpdateSchema>;
export type BusinessProfileUpdateInput = z.infer<
  typeof businessProfileUpdateSchema
>;

type ActionFailure = Readonly<{ ok: false; message: string }>;

export type InviteTeamResult =
  | Readonly<{
      ok: true;
      id: string;
      path: string;
      email: string;
      role: TeamInviteInput["role"];
    }>
  | ActionFailure;
export type TeamMemberActionResult =
  | Readonly<{ ok: true; member: TeamMember }>
  | ActionFailure;
export type BusinessProfileActionResult =
  | Readonly<{ ok: true; profile: BusinessProfile }>
  | ActionFailure;
export type RevokeInviteResult =
  | Readonly<{ ok: true; id: string }>
  | ActionFailure;
export type AcceptInviteResult =
  | Readonly<{ ok: true; businessName: string }>
  | ActionFailure;

export type InviteTeamAction = (
  input: TeamInviteInput,
) => Promise<InviteTeamResult>;
export type UpdateTeamMemberAction = (
  input: TeamMemberUpdateInput,
) => Promise<TeamMemberActionResult>;
export type UpdateBusinessProfileAction = (
  input: BusinessProfileUpdateInput,
) => Promise<BusinessProfileActionResult>;
export type RevokeTeamInviteAction = (id: string) => Promise<RevokeInviteResult>;
export type AcceptTeamInviteAction = (
  token: string,
) => Promise<AcceptInviteResult>;

export type TeamInvitationList = TeamInvitation[];
