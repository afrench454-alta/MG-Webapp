import type { Client, JobRequest, Property } from "../domain";
import { resolveDemoInlineClient, type InlineClientInput } from "./inline-client";

type WorkCustomerInput = {
  jobRequestId?: string;
  clientId?: string;
  propertyId?: string;
  inlineClient?: InlineClientInput;
};

export function demoWorkCustomer(input: WorkCustomerInput, clients: Client[], requests: JobRequest[]) {
  const request = requests.find((item) => item.id === input.jobRequestId);
  const inline = input.inlineClient ? resolveDemoInlineClient(input.inlineClient, clients) : undefined;
  const client = inline?.client ?? clients.find((item) => item.id === (request?.clientId ?? input.clientId));
  const propertyId = request?.propertyId ?? input.propertyId;
  const property: Property | undefined = inline?.property ?? client?.properties.find(
    (item, index) => (item.id || `${client.id}-property-${index}`) === propertyId,
  );
  return { request, client, property, createdClient: inline?.client };
}
