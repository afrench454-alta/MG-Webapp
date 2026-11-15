import { z } from "zod";
import type { Client } from "../domain";
import { normalizePhone } from "./client-import";

export const inlineClientSchema = z.object({
  name: z.string().trim().min(1, "Enter a client name.").max(200),
  phone: z.string().trim().max(80).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]).optional(),
  siteAddress: z.string().trim().max(500).optional(),
});

export type InlineClientInput = z.infer<typeof inlineClientSchema>;

export function matchInlineContact(input: InlineClientInput, clients: Client[]) {
  const email = input.email?.trim().toLowerCase();
  const phone = normalizePhone(input.phone || "");
  const matches = clients.filter((client) => (phone && normalizePhone(client.phone) === phone)
    || (email && client.email.trim().toLowerCase() === email));
  if (matches.length > 1) throw new Error("More than one client has these contact details. Choose an existing client.");
  return matches[0];
}

export function resolveDemoInlineClient(input: InlineClientInput, clients: Client[]) {
  const details = inlineClientSchema.parse(input);
  const existing = matchInlineContact(details, clients);
  const site = details.siteAddress?.trim();
  const property = site
    ? existing?.properties.find((item) => item.address.trim().toLowerCase() === site.toLowerCase()) ??
      { id: crypto.randomUUID(), name: "Service site", address: site, cadence: "One-off" }
    : undefined;
  const client: Client = existing ? {
    ...existing,
    properties: property && !existing.properties.includes(property) ? [...existing.properties, property] : existing.properties,
  } : {
    id: crypto.randomUUID(),
    name: details.name,
    status: "Active",
    phone: details.phone || "",
    email: details.email || "",
    preferred: details.email ? "Email" : "Phone",
    properties: property ? [property] : [],
    notes: "",
  };
  return { client, property };
}
