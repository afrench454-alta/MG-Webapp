import { z } from "zod";

import type { JobRequest } from "../domain";
import { serviceCategories } from "./service-catalog";

export const jobRequestDraftSchema = z.object({
  clientId: z.uuid(),
  propertyId: z.uuid(),
  category: z.enum(serviceCategories),
  serviceDetail: z.string().trim().max(80).optional(),
  scope: z.string().trim().min(1).max(20_000),
});

export type JobRequestMutationInput = z.infer<typeof jobRequestDraftSchema>;

export type JobRequestActionResult =
  | Readonly<{ ok: true; request: JobRequest }>
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
