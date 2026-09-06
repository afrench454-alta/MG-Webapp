"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Save } from "lucide-react";
import type { Client, Job, LineItem, Quote } from "../domain";
import { formatWorkLabel } from "../data/work-identity";
import { Button, Field } from "../components/ui-elements";
import { LineItemEditor, Totals } from "../components/line-item-editor";

export type InvoiceDraft = {
  clientId: string;
  propertyId: string;
  extraPropertyIds?: string[];
  jobId?: string;
  quoteId?: string;
  items: LineItem[];
  dueDays: string;
  notes: string;
};

export function InvoiceFormDialog({
  clients,
  jobs,
  prefill,
  sourceQuote,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  clients: Client[];
  jobs: Job[];
  prefill?: InvoiceDraft;
  sourceQuote?: Quote;
  onClose: () => void;
  onSave: (draft: InvoiceDraft) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [clientId, setClientId] = useState(prefill?.clientId || "");
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState(prefill?.propertyId || "");
  const [extraPropertyIds, setExtraPropertyIds] = useState<string[]>(
    prefill?.extraPropertyIds || [],
  );
  const [jobId, setJobId] = useState(prefill?.jobId || "");
  const [items, setItems] = useState<LineItem[]>(
    prefill?.items?.length
      ? prefill.items.map((item) => ({ ...item }))
      : [{ description: "", quantity: 1, rate: 0 }],
  );
  const [dueDays, setDueDays] = useState(prefill?.dueDays || "7");
  const [notes, setNotes] = useState(
    prefill?.notes ||
      "Invoices are due upon completion with a 7-day grace period.",
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientId || !propertyId || items.some((item) => !item.description))
      return;
    void onSave({
      clientId,
      propertyId,
      extraPropertyIds: extraPropertyIds.filter((id) => id !== propertyId),
      jobId: jobId || undefined,
      quoteId: prefill?.quoteId,
      items,
      dueDays,
      notes,
    });
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      {sourceQuote ? (
        <p className="form-banner">
          Prefilling from quote {sourceQuote.documentNumber || sourceQuote.id}.
          Review line items, dates, and notes before saving.
        </p>
      ) : null}
      <div className="form-grid form-grid--two">
        <Field label="Client" required>
          <select
            value={clientId}
            onChange={(event) => {
              const next = clients.find(
                (client) => client.id === event.target.value,
              );
              setClientId(event.target.value);
              setPropertyId(next?.properties[0]?.id || "");
              setExtraPropertyIds([]);
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
        <Field label="Prefill from job">
          <select
            value={jobId}
            onChange={(event) => {
              const next = jobs.find((job) => job.id === event.target.value);
              setJobId(event.target.value);
              if (next) {
                const client =
                  clients.find((item) => item.id === next.clientId) ||
                  clients.find((item) => item.name === next.client);
                setClientId(client?.id || "");
                setPropertyId(
                  client?.properties.find(
                    (property) =>
                      property.id === next.serviceAddressId ||
                      property.address === next.address,
                  )?.id || "",
                );
                setExtraPropertyIds([]);
              }
            }}
            disabled={pending}
          >
            <option value="">Start blank</option>
            {jobs.map((job) => (
              <option value={job.id} key={job.id}>
                {formatWorkLabel(job)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Address / Property" required>
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
              key={property.id || property.address}
            >
              {property.address}
            </option>
          ))}
        </select>
      </Field>
      {(selectedClient?.properties || []).filter(
        (property) => property.id && property.id !== propertyId,
      ).length ? (
        <fieldset className="property-checklist">
          <legend>Also include these properties</legend>
          {(selectedClient?.properties || [])
            .filter((property) => property.id && property.id !== propertyId)
            .map((property) => (
              <label key={property.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={extraPropertyIds.includes(property.id!)}
                  disabled={pending}
                  onChange={() => {
                    const id = property.id!;
                    setExtraPropertyIds((current) =>
                      current.includes(id)
                        ? current.filter((value) => value !== id)
                        : [...current, id],
                    );
                  }}
                />
                <span>{property.address}</span>
              </label>
            ))}
        </fieldset>
      ) : null}
      <LineItemEditor items={items} setItems={setItems} />
      <Totals items={items} />
      <div className="form-grid form-grid--three">
        <Field label="Payment due">
          <input value="Upon completion" readOnly />
        </Field>
        <Field label="Grace period (days)">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={dueDays}
            onChange={(event) => setDueDays(event.target.value)}
          />
        </Field>
        <Field label="Tax rate">
          <input value="0.00%" readOnly />
        </Field>
      </div>
      <Field label="Notes to client">
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
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
        <Button icon={Save} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Invoice"}
        </Button>
      </div>
    </form>
  );
}
