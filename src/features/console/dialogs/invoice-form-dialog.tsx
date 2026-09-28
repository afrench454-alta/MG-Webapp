"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Save } from "lucide-react";
import type { Client, Invoice, Job, LineItem, Quote } from "../domain";
import { invoicePrefillJobs, rankedClients } from "../data/form-options";
import { formatWorkLabel } from "../data/work-identity";
import { EntityPicker } from "../components/entity-picker";
import { Button, Field } from "../components/ui-elements";
import { LineItemEditor, Totals } from "../components/line-item-editor";

export type InvoiceDraft = {
  id?: string;
  clientId: string;
  propertyId: string;
  extraPropertyIds?: string[];
  jobId?: string;
  quoteId?: string;
  scope?: string;
  items: LineItem[];
  dueDays: string;
  notes: string;
};

export function InvoiceFormDialog({
  clients,
  jobs,
  invoices = [],
  prefill,
  sourceQuote,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  clients: Client[];
  jobs: Job[];
  invoices?: Invoice[];
  prefill?: InvoiceDraft;
  sourceQuote?: Quote;
  onClose: () => void;
  onSave: (draft: InvoiceDraft) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const editing = Boolean(prefill?.id);
  const [clientId, setClientId] = useState(prefill?.clientId || "");
  const selectedClient = clients.find((client) => client.id === clientId);
  const [propertyId, setPropertyId] = useState(prefill?.propertyId || "");
  const [extraPropertyIds, setExtraPropertyIds] = useState<string[]>(
    prefill?.extraPropertyIds || [],
  );
  const [jobId, setJobId] = useState(prefill?.jobId || "");
  const [scope, setScope] = useState(prefill?.scope || sourceQuote?.scope || "");
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

  const clientOptions = useMemo(
    () =>
      rankedClients(clients).map((client) => ({
        id: client.id,
        label: `${client.name}${client.status === "Active" ? "" : ` · ${client.status}`}`,
        keywords: `${client.email} ${client.phone} ${client.properties.map((property) => property.address).join(" ")}`,
      })),
    [clients],
  );

  const visibleJobs = useMemo(
    () =>
      invoicePrefillJobs({
        jobs,
        invoices,
        client: selectedClient,
        selectedJobId: jobId,
      }),
    [jobs, invoices, selectedClient, jobId],
  );

  const jobOptions = useMemo(
    () =>
      visibleJobs.map((job) => ({
        id: job.id,
        label: formatWorkLabel(job),
        keywords: `${job.client} ${job.address} ${job.scope} ${job.status}`,
      })),
    [visibleJobs],
  );

  const applyJob = (nextJobId: string) => {
    setJobId(nextJobId);
    const next = jobs.find((job) => job.id === nextJobId);
    if (!next) return;
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
    if (!scope.trim() && next.scope.trim()) setScope(next.scope);
    const blankItems =
      items.length === 1 && !items[0]?.description.trim() && !Number(items[0]?.rate);
    if (blankItems && next.scope.trim()) {
      setItems([{ description: next.scope, quantity: 1, rate: 0 }]);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientId || !propertyId || items.some((item) => !item.description))
      return;
    void onSave({
      id: prefill?.id,
      clientId,
      propertyId,
      extraPropertyIds: extraPropertyIds.filter((id) => id !== propertyId),
      jobId: jobId || undefined,
      quoteId: prefill?.quoteId,
      scope: scope.trim(),
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
          Review scope, line items, and notes before saving.
        </p>
      ) : null}
      <div className="form-grid form-grid--two">
        <EntityPicker
          label="Client"
          required
          value={clientId}
          onChange={(nextId) => {
            const next = clients.find((client) => client.id === nextId);
            setClientId(nextId);
            setPropertyId(next?.properties[0]?.id || "");
            setExtraPropertyIds([]);
            if (jobId && !matchesSelectedJob(jobs, jobId, next)) {
              setJobId("");
            }
          }}
          options={clientOptions}
          placeholder="Choose a client"
          filterPlaceholder="Search clients by name, phone, or address"
          disabled={pending}
        />
        <EntityPicker
          label="Prefill from job"
          hint={
            selectedClient
              ? "Showing this client's open jobs"
              : "Pick a client first to narrow the list"
          }
          value={jobId}
          onChange={applyJob}
          options={jobOptions}
          placeholder={selectedClient ? "Start blank" : "Choose a client or job"}
          filterPlaceholder="Search jobs by site or scope"
          emptyLabel="No matching jobs"
          disabled={pending}
        />
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
      <Field
        label="Scope of work"
        hint="Printed on the invoice. One idea per line."
      >
        <textarea
          className="scope-editor"
          rows={5}
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          disabled={pending}
          placeholder="What was completed at this property?"
        />
      </Field>
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
            disabled={pending}
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
        <Button icon={Save} type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Save Invoice"}
        </Button>
      </div>
    </form>
  );
}

function matchesSelectedJob(
  jobs: Job[],
  jobId: string,
  client: Client | undefined,
): boolean {
  if (!client) return false;
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return false;
  if (job.clientId && job.clientId === client.id) return true;
  return job.client.trim().toLowerCase() === client.name.trim().toLowerCase();
}
