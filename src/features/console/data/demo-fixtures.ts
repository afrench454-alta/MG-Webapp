import { invoiceSeed, type Client, type Job, type JobRequest, type JobStatus, type Quote, type TeamMember } from "../domain";
import { brisbaneDateKey } from "./work-identity";

const manager: TeamMember = { id: "demo-owner", name: "Demo owner", email: "owner@example.test", role: "Owner", isActive: true };
const technician: TeamMember = { id: "demo-tech", name: "Demo technician", email: "technician@example.test", role: "Worker", isActive: true };
const statuses: JobStatus[] = ["unscheduled", "scheduled", "in-progress", "on-hold", "completed", "cancelled"];

export function populatedDemo(now = new Date(), field = false) {
  const today = brisbaneDateKey(now);
  const tomorrow = brisbaneDateKey(new Date(now.getTime() + 86_400_000));
  const directory: Client[] = statuses.map((status, index) => ({
    id: `demo-client-${status}`,
    name: `Demo ${status.replaceAll("-", " ")} customer`,
    status: "Active",
    phone: "",
    email: `${status}@example.test`,
    preferred: "Email",
    properties: [{ id: `demo-site-${status}`, name: "Service site", address: `${index + 1} Example Road, Demo QLD`, cadence: "One-off" }],
    notes: "",
  }));
  const requests: JobRequest[] = [0, 1].map((index) => ({
    id: `demo-request-${index + 1}`,
    clientId: directory[index].id,
    propertyId: directory[index].properties[0].id,
    client: directory[index].name,
    address: directory[index].properties[0].address,
    category: "Lawn Mowing",
    scope: "Mow the front lawn and tidy the edges.",
    status: index ? "Quoting" : "New",
    created: today,
  }));
  const jobs: Job[] = statuses.map((status, index) => {
    const client = directory[index];
    const property = client.properties[0];
    const dateKey = status === "unscheduled" ? "" : status === "scheduled" ? tomorrow : today;
    return {
      id: `demo-job-${status}`,
      displayName: client.name,
      clientId: client.id,
      serviceAddressId: property.id,
      client: client.name,
      property: property.name,
      address: property.address,
      category: "Lawn Mowing",
      scope: "Mow the front lawn and tidy the edges.",
      dateKey: dateKey ? `${dateKey}T09:00` : "",
      date: dateKey,
      time: dateKey ? "9:00 am" : "",
      status,
      notes: "",
      recurrence: "One-off",
      assigneeIds: [technician.id],
      assignees: [technician.name],
      photos: [],
    };
  });
  const quotes: Quote[] = Array.from({ length: 48 }, (_, index) => ({
    id: `demo-quote-${index + 1}`,
    clientId: directory[0].id,
    client: directory[0].name,
    address: directory[0].properties[0].address,
    issued: today,
    expires: tomorrow,
    validDays: 1,
    status: "Draft",
    scope: "Quote for routine mowing",
    clientNotes: "",
    items: [{ description: "Mowing", quantity: 1, rate: 80 }],
  }));
  return {
    actorRole: field ? "technician" as const : "owner" as const,
    actorId: field ? technician.id : manager.id,
    signedInEmail: field ? technician.email : manager.email,
    canManageRequests: !field,
    canManageClients: !field,
    teamMembers: [manager, technician],
    initialClients: directory,
    initialJobRequests: field ? [] : requests,
    initialJobs: jobs,
    initialQuotes: field ? [] : quotes,
    initialInvoices: field ? [] : [{
      ...invoiceSeed, id: "demo-invoice-draft", clientId: directory[0].id, serviceAddressId: directory[0].properties[0].id,
      client: directory[0].name, address: directory[0].properties[0].address, issued: today, issueDate: today, due: tomorrow, dueDate: tomorrow,
      items: [{ description: "Mowing", quantity: 2, rate: 100 }],
    }],
  };
}
