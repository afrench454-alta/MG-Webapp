import { z } from "zod";

import type { LineItem } from "../domain";
import { serviceCategories } from "./service-catalog";

export const estimateRequestSchema = z.object({
  category: z.enum(serviceCategories),
  serviceDetail: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  scope: z.string().trim().min(8).max(8_000),
  jobRequestId: z.uuid().optional(),
});

export const estimateLineItemSchema = z.object({
  description: z.string().trim().min(1).max(1_000),
  quantity: z.number().positive().max(100_000),
  unitLabel: z.string().trim().max(32).optional(),
  rate: z.number().min(0).max(10_000_000),
});

export const estimateResultSchema = z.object({
  summary: z.string().trim().min(1).max(2_000),
  assumptions: z.string().trim().max(2_000).optional().default(""),
  items: z.array(estimateLineItemSchema).min(1).max(20),
});

export type EstimateRequestInput = z.infer<typeof estimateRequestSchema>;
export type EstimateResult = z.infer<typeof estimateResultSchema>;

export type EstimateActionResult =
  | Readonly<{ ok: true; estimate: EstimateResult }>
  | Readonly<{ ok: false; message: string }>;

export type EstimateJobAction = (
  input: EstimateRequestInput,
) => Promise<EstimateActionResult>;

export function estimateToLineItems(estimate: EstimateResult): LineItem[] {
  return estimate.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitLabel: item.unitLabel || "ea",
    rate: item.rate,
  }));
}
