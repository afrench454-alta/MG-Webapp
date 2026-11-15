import { z } from "zod";

import type { Client, JobRequest } from "../domain";
import { inlineClientSchema } from "./inline-client";
import { serviceCategories } from "./service-catalog";

export const jobRequestDraftSchema = z.object({
  clientId: z.uuid().optional(),
  propertyId: z.uuid().optional(),
  inlineClient: inlineClientSchema.optional(),
  category: z.enum(serviceCategories),
  serviceDetail: z.string().trim().max(80).optional(),
  scope: z.string().trim().min(1).max(20_000),
  questionnaireResponseId: z.uuid().optional(),
}).refine((input) => input.inlineClient
  ? Boolean(input.inlineClient.siteAddress && !input.clientId && !input.propertyId)
  : Boolean(input.clientId && input.propertyId), "Choose one client and service address.");

export type JobRequestMutationInput = z.infer<typeof jobRequestDraftSchema>;

export type JobRequestActionResult =
  | Readonly<{ ok: true; request: JobRequest; client?: Client }>
  | Readonly<{ ok: false; message: string }>;

export type DeleteJobRequestActionResult =
  | Readonly<{ ok: true; requestId: string }>
  | Readonly<{ ok: false; message: string }>;

export type SaveJobRequestAction = (
  input: JobRequestMutationInput,
) => Promise<JobRequestActionResult>;

export type DeleteJobRequestAction = (
  requestId: string,
) => Promise<DeleteJobRequestActionResult>;

export const jobRequestClosedSchema = z.object({ id: z.uuid(), closed: z.boolean() });
export type SetJobRequestClosedAction = (input: z.infer<typeof jobRequestClosedSchema>) => Promise<JobRequestActionResult>;
