import { z } from "zod";

import type { BusinessProfile, TeamInvitation, TeamMember } from "../domain";

export const teamInviteSchema = z.object({
  email: z.email().max(320),
  role: z.enum(["Co-owner", "Worker"]),
});

export const teamMemberUpdateSchema = z.object({
  profileId: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["Co-owner", "Worker"]).optional(),
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

export const joinWithPasswordSchema = z
  .object({
    token: z.string().min(32).max(512),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Password is too long."),
    confirm: z.string().min(1, "Confirm your password.").max(72),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
export type TeamMemberUpdateInput = z.infer<typeof teamMemberUpdateSchema>;
export type BusinessProfileUpdateInput = z.infer<
  typeof businessProfileUpdateSchema
>;
export type JoinWithPasswordInput = z.infer<typeof joinWithPasswordSchema>;

export type TeamInvitePreview = Readonly<{
  email: string;
  businessName: string;
  role: "Co-owner" | "Worker";
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}>;

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
