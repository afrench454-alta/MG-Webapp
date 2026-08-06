import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { JobRequest } from "../domain";
import type { JobRequestMutationInput } from "./job-request-contract";

const jobRequestRowSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid().nullable(),
  service_address_id: z.uuid().nullable(),
  status: z.enum(["new", "qualified", "quoting", "scheduled", "closed", "rejected"]),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  clients: z.object({ display_name: z.string() }).nullable(),
  client_addresses: z.object({ line_1: z.string(), label: z.string().nullable() }).nullable(),
});

const addressRowSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  line_1: z.string(),
  label: z.string().nullable(),
});

const JOB_REQUEST_SELECT = `
  id,
  client_id,
  service_address_id,
  status,
  title,
  description,
  created_at,
  clients (
    display_name
  ),
  client_addresses (
    line_1,
    label
  )
`;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date(value));
}

function mapStatus(status: z.infer<typeof jobRequestRowSchema>["status"]): JobRequest["status"] {
  switch (status) {
    case "qualified":
      return "Qualified";
    case "quoting":
      return "Quoting";
    case "scheduled":
      return "Scheduled";
    case "closed":
      return "Closed";
    case "rejected":
      return "Rejected";
    default:
      return "New";
  }
}

function mapJobRequest(rowValue: unknown): JobRequest {
  const row = jobRequestRowSchema.parse(rowValue);

  return {
    id: row.id,
    clientId: row.client_id || undefined,
    propertyId: row.service_address_id || undefined,
    client: row.clients?.display_name || "Unassigned client",
    address: row.client_addresses?.line_1 || "No service address",
    category: row.title,
    scope: row.description || "",
    status: mapStatus(row.status),
    created: formatDate(row.created_at),
  };
}

export async function listJobRequests(context: BusinessContext): Promise<JobRequest[]> {
  if (context.role === "technician") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_requests")
    .select(JOB_REQUEST_SELECT)
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load job requests: ${error.message}`);
  return (data || []).map(mapJobRequest);
}

export async function saveJobRequest(
  context: BusinessContext,
  input: JobRequestMutationInput,
): Promise<JobRequest> {
  const supabase = await createClient();
  const { data: addressData, error: addressError } = await supabase
    .from("client_addresses")
    .select("id, client_id, line_1, label")
    .eq("business_id", context.businessId)
    .eq("id", input.propertyId)
    .eq("client_id", input.clientId)
    .single();

  if (addressError) {
    throw new Error(`Unable to verify the service address: ${addressError.message}`);
  }

  const address = addressRowSchema.parse(addressData);
  const { data, error } = await supabase
    .from("job_requests")
    .insert({
      business_id: context.businessId,
      client_id: input.clientId,
      service_address_id: input.propertyId,
      status: "new",
      title: input.category,
      description: input.scope,
      source: "manual",
      created_by: context.actorId,
      service_address_snapshot: {
        label: address.label,
        line_1: address.line_1,
      },
    })
    .select(JOB_REQUEST_SELECT)
    .single();

  if (error) throw new Error(`Unable to save the job request: ${error.message}`);
  return mapJobRequest(data);
}

export async function deleteJobRequest(
  context: BusinessContext,
  requestId: string,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_requests")
    .delete()
    .eq("business_id", context.businessId)
    .eq("id", requestId)
    .select("id")
    .single();

  if (error) throw new Error(`Unable to delete the job request: ${error.message}`);
  return z.object({ id: z.uuid() }).parse(data).id;
}
