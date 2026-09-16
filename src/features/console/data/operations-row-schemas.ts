import { z } from "zod";

/** Matches `client_addresses.label`, which is nullable in Postgres. */
export const addressRowSchema = z.object({
  id: z.uuid(),
  label: z.string().nullable().optional(),
  line_1: z.string(),
});

export type AddressLookup = { label: string; line1: string };

export function parseAddressLookups(rows: unknown): Map<string, AddressLookup> {
  return new Map(
    z
      .array(addressRowSchema)
      .parse(rows ?? [])
      .map((row) => [
        row.id,
        {
          label: row.label?.trim() || row.line_1,
          line1: row.line_1,
        },
      ]),
  );
}

export const lineItemRowSchema = z.object({
  label: z.string().nullable().optional(),
  description: z.string(),
  quantity: z.coerce.number(),
  unit_label: z.string().nullable().optional(),
  unit_price: z.coerce.number(),
  tax_rate: z.coerce.number().optional(),
});
