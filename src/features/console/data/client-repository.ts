import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { Client } from "../domain";
import type { ClientMutationInput } from "./client-contract";

const clientRowSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  lifecycle_status: z.enum(["lead", "active", "inactive"]),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  preferred_contact: z.enum(["email", "phone", "sms"]),
  notes: z.string().nullable(),
  client_contacts: z
    .array(
      z.object({
        full_name: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        is_primary: z.boolean(),
      }),
    )
    .default([]),
  client_addresses: z
    .array(
      z.object({
        id: z.uuid(),
        kind: z.enum(["service", "billing", "postal", "other"]),
        label: z.string().nullable(),
        line_1: z.string(),
        service_cadence: z.string().nullable(),
        is_active: z.boolean(),
        is_primary: z.boolean(),
        created_at: z.string(),
      }),
    )
    .default([]),
});

const CLIENT_SELECT = `
  id,
  display_name,
  lifecycle_status,
  phone,
  email,
  preferred_contact,
  notes,
  client_contacts (
    full_name,
    email,
    phone,
    is_primary
  ),
  client_addresses (
    id,
    kind,
    label,
    line_1,
    service_cadence,
    is_active,
    is_primary,
    created_at
  )
`;

function mapClient(rowValue: unknown): Client {
  const row = clientRowSchema.parse(rowValue);
  const primaryContact = row.client_contacts.find((contact) => contact.is_primary);
  const status = {
    lead: "Lead",
    active: "Active",
    inactive: "Inactive",
  }[row.lifecycle_status] as Client["status"];
  const preferred = {
    email: "Email",
    phone: "Phone",
    sms: "SMS",
  }[row.preferred_contact] as Client["preferred"];

  const properties = row.client_addresses
    .filter((address) => address.kind === "service" && address.is_active)
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      return left.created_at.localeCompare(right.created_at);
    })
    .map((address) => ({
      id: address.id,
      name: address.label || "Property",
      address: address.line_1,
      cadence: address.service_cadence || "One-off",
    }));

  return {
    id: row.id,
    name: row.display_name,
    status,
    phone: row.phone || primaryContact?.phone || "",
    email: row.email || primaryContact?.email || "",
    preferred,
    properties,
    notes: row.notes || "",
  };
}

export async function listClients(context: BusinessContext): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("business_id", context.businessId)
    .is("archived_at", null)
    .order("display_name", { ascending: true });

  if (error) throw new Error(`Unable to load clients: ${error.message}`);
  return (data || []).map(mapClient);
}

export async function getClientById(
  context: BusinessContext,
  clientId: string,
): Promise<Client> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("business_id", context.businessId)
    .eq("id", clientId)
    .is("archived_at", null)
    .single();

  if (error) throw new Error(`Unable to load the saved client: ${error.message}`);
  return mapClient(data);
}

export async function saveClient(
  context: BusinessContext,
  input: ClientMutationInput,
): Promise<Client> {
  const supabase = await createClient();
  const existingId = z.uuid().safeParse(input.id);
  const { data, error } = await supabase.rpc("save_client_with_details", {
    client_payload: {
      name: input.name,
      status: input.status.toLowerCase(),
      phone: input.phone,
      email: input.email,
      preferred: input.preferred.toLowerCase(),
      notes: input.notes,
      properties: input.properties,
    },
    target_client_id: existingId.success ? existingId.data : null,
  });

  if (error) throw new Error(`Unable to save the client: ${error.message}`);
  const savedClientId = z.uuid().parse(data);
  return getClientById(context, savedClientId);
}

export async function archiveClient(
  context: BusinessContext,
  clientId: string,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_client", {
    target_client_id: clientId,
  });

  if (error) throw new Error(`Unable to archive the client: ${error.message}`);
  return z.uuid().parse(data);
}
