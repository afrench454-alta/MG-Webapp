"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Save } from "lucide-react";
import type { Client, JobRequestDraft } from "../domain";
import type { InlineClientInput } from "../data/inline-client";
import {
  detailsForCategory,
  serviceCatalog,
  summarizeServiceCategory,
} from "../data/service-catalog";
import { Button, Field } from "../components/ui-elements";
import { InlineClientFields } from "../components/inline-client-fields";

export function RequestFormDialog({
  clients,
  prefill,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  clients: Client[];
  prefill?: Partial<JobRequestDraft> & { clientId?: string; propertyId?: string };
  onClose: () => void;
  onSave: (draft: JobRequestDraft) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [clientId, setClientId] = useState(prefill?.clientId || "");
  const [inlineClient, setInlineClient] = useState<InlineClientInput | undefined>(prefill?.inlineClient);
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState(
    prefill?.propertyId || selectedClient?.properties[0]?.id || "",
  );
  const [category, setCategory] = useState<JobRequestDraft["category"]>(
    prefill?.category || "Cleaning Services",
  );
  const [serviceDetail, setServiceDetail] = useState(prefill?.serviceDetail || "");
  const [scope, setScope] = useState(prefill?.scope || "");
  const details = detailsForCategory(category);
  const selectClient = (client: Client | undefined) => {
    setClientId(client?.id || "");
    setPropertyId(client?.properties[0]?.id || "");
    setInlineClient(undefined);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!inlineClient && (!clientId || !propertyId)) || !scope.trim()) return;
    void onSave({
      clientId: inlineClient ? undefined : clientId,
      propertyId: inlineClient ? undefined : propertyId,
      inlineClient,
      category,
      serviceDetail: serviceDetail || undefined,
      scope,
      questionnaireResponseId: prefill?.questionnaireResponseId,
    });
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <fieldset className="form-stack" disabled={pending}>
      {!inlineClient ? <>
      <Field label="Client" required>
        <select
          value={clientId}
          onChange={(event) => selectClient(clients.find((client) => client.id === event.target.value))}
          required
          disabled={pending}
        >
          <option value="">Choose...</option>
          {clients.map((client) => (
            <option value={client.id} key={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>
      </> : null}
      <InlineClientFields value={inlineClient} onChange={setInlineClient} requireSite clients={clients} onSelectExisting={selectClient} />
      </fieldset>
      <Field label="Property" required>
        <select
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          required
          disabled={pending || !selectedClient}
        >
          <option value="">Choose...</option>
          {(selectedClient?.properties || []).map((property, index) => (
            <option
              value={property.id || `${clientId}-property-${index}`}
              key={
                property.id || `${property.name}-${property.address}`
              }
            >
              {property.address}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid form-grid--two">
        <Field
          label="Service"
          required
          hint={summarizeServiceCategory(category) || undefined}
        >
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as JobRequestDraft["category"]);
              setServiceDetail("");
            }}
            required
            disabled={pending}
          >
            {serviceCatalog.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service type" hint="Optional">
          <select
            value={serviceDetail}
            onChange={(event) => setServiceDetail(event.target.value)}
            disabled={pending || !details.length}
          >
            <option value="">Any / not specified</option>
            {details.map((detail) => (
              <option value={detail} key={detail}>
                {detail}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Job Request" required>
        <textarea
          rows={4}
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          required
          disabled={pending}
        />
      </Field>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" icon={Save} disabled={pending}>
          {pending ? "Saving..." : "Save Request"}
        </Button>
      </div>
    </form>
  );
}
