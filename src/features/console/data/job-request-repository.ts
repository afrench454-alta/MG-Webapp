import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { JobRequest } from "../domain";
import type { JobRequestMutationInput } from "./job-request-contract";
import { formatServiceTitle } from "./service-catalog";

const jobRequestRowSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid().nullable(),
  service_address_id: z.uuid().nullable(),
  status: z.enum(["new", "qualified", "quoting", "scheduled", "closed", "rejected"]),
  previous_open_status: z.enum(["new", "qualified", "quoting", "scheduled"]).nullable(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  clients: z.object({ display_name: z.string() }).nullable(),
  client_addresses: z.object({ line_1: z.string(), label: z.string().nullable() }).nullable(),
});

const JOB_REQUEST_SELECT = `
  id,
  client_id,
  service_address_id,
  status,
  previous_open_status,
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

const openStatuses = { new: "New", qualified: "Qualified", quoting: "Quoting", scheduled: "Scheduled" } as const;

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
    previousStatus: row.previous_open_status ? openStatuses[row.previous_open_status] : null,
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

async function getJobRequest(context: BusinessContext, id: string): Promise<JobRequest> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_requests").select(JOB_REQUEST_SELECT)
    .eq("business_id", context.businessId).eq("id", id).single();
  if (error) throw new Error(error.message);
  return mapJobRequest(data);
}

export async function saveJobRequest(
  context: BusinessContext,
  input: JobRequestMutationInput,
): Promise<JobRequest> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_work_request", {
    target_business_id: context.businessId,
    draft: { ...input, title: formatServiceTitle(input.category, input.serviceDetail) },
  });
  if (error) throw new Error(error.message);
  return getJobRequest(context, z.uuid().parse(data));
}

export async function setJobRequestClosed(
  context: BusinessContext,
  id: string,
  closed: boolean,
): Promise<JobRequest> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_work_request_closed", {
    target_business_id: context.businessId,
    target_request_id: id,
    is_closed: closed,
  });
  if (error) throw new Error(error.message);
  return getJobRequest(context, z.uuid().parse(data));
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
