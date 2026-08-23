"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Save } from "lucide-react";
import type { Client, JobRequestDraft } from "../domain";
import { Button, Field } from "../components/ui-elements";

export function RequestFormDialog({
  clients,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  clients: Client[];
  onClose: () => void;
  onSave: (draft: JobRequestDraft) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [clientId, setClientId] = useState("");
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState<JobRequestDraft["category"]>(
    "Standard / General Clean",
  );
  const [scope, setScope] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientId || !propertyId || !scope) return;
    void onSave({ clientId, propertyId, category, scope });
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <Field label="Client" required>
        <select
          value={clientId}
          onChange={(event) => {
            const nextClientId = event.target.value;
            const nextClient = clients.find(
              (client) => client.id === nextClientId,
            );
            setClientId(nextClientId);
            setPropertyId(nextClient?.properties[0]?.id || "");
          }}
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
      <Field label="Service category" required>
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as JobRequestDraft["category"])
          }
          required
          disabled={pending}
        >
          <option value="Standard / General Clean">
            Standard / General Clean
          </option>
          <option value="Bond Clean / End of Lease">
            Bond Clean / End of Lease
          </option>
          <option value="Yard Cleanup">Yard Cleanup</option>
          <option value="Property Maintenance">Property Maintenance</option>
        </select>
      </Field>
      <Field label="Scope summary" required>
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
