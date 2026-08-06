import { z } from "zod";

import type { JobRequest } from "../domain";

export const jobRequestDraftSchema = z.object({
  clientId: z.uuid(),
  propertyId: z.uuid(),
  category: z.enum([
    "Standard / General Clean",
    "Bond Clean / End of Lease",
    "Yard Cleanup",
    "Property Maintenance",
  ]),
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
