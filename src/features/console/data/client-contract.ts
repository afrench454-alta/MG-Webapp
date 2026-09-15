import { z } from "zod";

import type { Client } from "../domain";
import type { ClientImportPlan } from "./client-import";

const propertySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().max(160),
  address: z.string().trim().max(500),
  cadence: z.string().trim().min(1).max(120),
});

export const clientMutationSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  status: z.enum(["Lead", "Active", "Inactive"]),
  phone: z.string().trim().min(3, "Enter a valid client phone number.").max(80),
  email: z.union([
    z.literal(""),
    z.string().trim().email("Enter a valid client email.").max(320),
  ]),
  preferred: z.enum(["Email", "Phone", "SMS"]),
  properties: z.array(propertySchema).max(50),
  notes: z.string().trim().max(20_000),
});

export type ClientMutationInput = z.infer<typeof clientMutationSchema>;

export type ClientActionResult =
  | Readonly<{ ok: true; client: Client }>
  | Readonly<{ ok: false; message: string }>;

export type ClientArchiveResult =
  | Readonly<{ ok: true; clientId: string }>
  | Readonly<{ ok: false; message: string }>;

export type SaveClientAction = (
  input: ClientMutationInput,
) => Promise<ClientActionResult>;

export type ArchiveClientAction = (
  clientId: string,
) => Promise<ClientArchiveResult>;

export const clientImportTextSchema = z.object({
  jsonText: z.string().trim().min(2).max(400_000),
});

export type ClientImportPreviewResult =
  | Readonly<{ ok: true; plan: ClientImportPlan }>
  | Readonly<{ ok: false; message: string }>;

export type ClientImportCommitResult =
  | Readonly<{
      ok: true;
      created: Client[];
      skipped: number;
      failed: Array<{ name: string; message: string }>;
    }>
  | Readonly<{ ok: false; message: string }>;

export type PreviewClientImportAction = (
  input: { jsonText: string },
) => Promise<ClientImportPreviewResult>;

export type CommitClientImportAction = (
  input: { jsonText: string },
) => Promise<ClientImportCommitResult>;
