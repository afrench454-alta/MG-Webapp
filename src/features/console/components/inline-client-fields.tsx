"use client";

import type { InlineClientInput } from "../data/inline-client";
import type { Client } from "../domain";
import { Button, Field } from "./ui-elements";

export function InlineClientFields({
  value, onChange, requireSite = false, clients = [], onSelectExisting,
}: {
  value: InlineClientInput | undefined;
  onChange: (value: InlineClientInput | undefined) => void;
  requireSite?: boolean;
  clients?: Client[];
  onSelectExisting?: (client: Client) => void;
}) {
  if (!value) {
    return <Button type="button" variant="secondary" onClick={() => onChange({ name: "" })}>Add new client</Button>;
  }
  const name = value.name.trim().toLowerCase();
  const matches = name ? clients.filter((client) => client.name.trim().toLowerCase() === name) : [];

  return (
    <fieldset className="inline-client-fields">
      <legend>New client</legend>
      <Field label="Client name">
        <input required autoComplete="name" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      </Field>
      {matches.length && onSelectExisting ? (
        <div className="inline-client-fields__matches">
          <p>Clients with this name</p>
          {matches.map((client) => (
            <Button key={client.id} type="button" variant="secondary" onClick={() => onSelectExisting(client)}>
              {client.name}{client.email || client.phone ? ` · ${client.email || client.phone}` : ""}
            </Button>
          ))}
        </div>
      ) : null}
      <Field label="Phone">
        <input type="tel" autoComplete="tel" value={value.phone ?? ""} onChange={(event) => onChange({ ...value, phone: event.target.value })} />
      </Field>
      <Field label="Email">
        <input type="email" autoComplete="email" value={value.email ?? ""} onChange={(event) => onChange({ ...value, email: event.target.value })} />
      </Field>
      <Field label="Service address">
        <input required={requireSite} autoComplete="street-address" value={value.siteAddress ?? ""} onChange={(event) => onChange({ ...value, siteAddress: event.target.value })} />
      </Field>
      <Button type="button" variant="secondary" onClick={() => onChange(undefined)}>Use existing client</Button>
    </fieldset>
  );
}
