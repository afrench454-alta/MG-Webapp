import { z } from "zod";

import type { Client } from "../domain";

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
  phone: z.string().trim().max(80),
  email: z.email("Enter a valid client email.").trim().max(320),
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
