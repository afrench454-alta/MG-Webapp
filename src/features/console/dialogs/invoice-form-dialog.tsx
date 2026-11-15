"use client";

import { useRef, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { invoiceTerms, money, type Client, type Invoice, type Job, type JobRequest, type LineItem, type Quote } from "../domain";
import { buildClientRateChips, rankedClients } from "../data/form-options";
import { formatWorkLabel } from "../data/work-identity";
import type { InlineClientInput } from "../data/inline-client";
import { invoiceDraftSchema, type InvoiceDraftInput } from "../data/invoice-contract";
import { brisbaneToday, invoiceLineTotal } from "../data/invoice-lifecycle";
import { draftInvoiceFromJob, draftInvoiceFromRequest, invoiceConflict } from "../data/quote-invoice";
import { EntityPicker } from "../components/entity-picker";
import { InlineClientFields } from "../components/inline-client-fields";
import { Button, Field } from "../components/ui-elements";
import { LineItemEditor } from "../components/line-item-editor";

export type InvoiceDraft = Omit<InvoiceDraftInput, "clientId" | "propertyId" | "issueDate" | "idempotencyKey" | "items"> & {
  clientId: string;
  propertyId: string;
  issueDate?: string;
  idempotencyKey?: string;
  items: LineItem[];
  sourceLocked?: boolean;
};

export function invoiceDraftActionInput(draft: InvoiceDraft): InvoiceDraftInput {
  return {
    ...draft,
    idempotencyKey: draft.idempotencyKey ?? crypto.randomUUID(),
    clientId: draft.clientId || undefined,
    propertyId: draft.propertyId || undefined,
    issueDate: draft.issueDate || brisbaneToday(),
    dueDate: draft.dueDate || undefined,
    serviceDate: draft.serviceDate || undefined,
    recipientEmail: draft.recipientEmail?.trim() || undefined,
    items: draft.items.map((item) => ({ ...item, quantity: Number(item.quantity), rate: Number(item.rate) })),
  };
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function newLine(): LineItem {
  return { description: "", quantity: 1, rate: 0 };
}

export function InvoiceFormDialog({
  clients, jobs, requests = [], quotes = [], invoices = [], prefill, sourceQuote, onClose, onSave, onViewExisting,
  pending = false, error = "",
}: {
  clients: Client[];
  jobs: Job[];
  requests?: JobRequest[];
  quotes?: Quote[];
  invoices?: Invoice[];
  prefill?: Partial<InvoiceDraft>;
  sourceQuote?: Quote;
  onClose: () => void;
  onSave: (draft: InvoiceDraft) => void | Promise<void>;
  onViewExisting?: (invoice: Invoice) => void;
  pending?: boolean;
  error?: string;
}) {
  const [draft, setDraft] = useState<InvoiceDraft>(() => {
    const issueDate = prefill?.issueDate ?? brisbaneToday();
    return {
      clientId: "", propertyId: "", notes: "", scope: "", terms: invoiceTerms,
      ...prefill, issueDate, dueDate: prefill?.dueDate ?? addDays(issueDate, 7),
      items: prefill?.items?.length ? prefill.items.map((item) => ({ ...item })) : [newLine()],
    };
  });
  const [localError, setLocalError] = useState("");
  const previousSubmission = useRef<{ payload: string; key: string } | undefined>(undefined);
  const selectedClient = clients.find((client) => client.id === draft.clientId);
  const currentInvoice = invoices.find((record) => record.id === draft.id);
  const sourceLocked = Boolean(draft.sourceLocked || sourceQuote);
  const conflict = currentInvoice?.duplicateSource ? undefined : invoiceConflict(draft, invoices);
  const requestVisits = draft.requestId ? jobs.filter((job) => job.jobRequestId === draft.requestId && job.status !== "cancelled") : [];
  const requiresVisit = !draft.jobId && requestVisits.length > 0 && currentInvoice?.requestId !== draft.requestId && !draft.replacesInvoiceId;
  const matchesClient = (id?: string | null) => Boolean(id && (!draft.clientId || draft.clientId === id));
  const eligibleRequests = requests.filter((request) => request.id === draft.requestId || matchesClient(request.clientId));
  const eligibleJobs = jobs.filter((job) => job.id === draft.jobId || (
    job.status === "completed" && matchesClient(job.clientId) && (!draft.requestId || job.jobRequestId === draft.requestId) &&
    (!sourceQuote || job.quoteId === sourceQuote.id || (!job.quoteId && job.jobRequestId === sourceQuote.jobRequestId))
  ));
  const rateChips = buildClientRateChips({
    client: selectedClient ? { id: selectedClient.id, name: selectedClient.name } : null,
    quotes, invoices,
  });
  const setField = <K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setLocalError("");
  };

  const selectClient = (clientId: string) => {
    setDraft((current) => ({
      ...current, clientId, inlineClient: undefined, propertyId: "", extraPropertyIds: [], jobId: undefined, requestId: undefined,
    }));
  };
  const setInlineClient = (inlineClient: InlineClientInput | undefined) => {
    setDraft((current) => ({
      ...current, clientId: "", inlineClient, propertyId: "", extraPropertyIds: [], jobId: undefined, requestId: undefined,
    }));
  };
  const applySource = (source: Partial<InvoiceDraft>) => {
    setDraft((current) => ({
      ...current, ...source, inlineClient: undefined, extraPropertyIds: [],
      scope: current.scope?.trim() ? current.scope : source.scope,
      items: current.items.some((item) => item.description.trim() || Number(item.rate))
        ? current.items : source.items ?? current.items,
    }));
  };
  const selectRequest = (id: string) => {
    const request = requests.find((entry) => entry.id === id);
    if (request) applySource({ ...draftInvoiceFromRequest(request), jobId: undefined });
    else setDraft((current) => ({ ...current, requestId: undefined, jobId: undefined }));
  };
  const selectJob = (id: string) => {
    const job = jobs.find((entry) => entry.id === id);
    if (job) applySource(draftInvoiceFromJob(job));
    else setField("jobId", undefined);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || conflict || requiresVisit) return;
    if (!draft.clientId && !draft.inlineClient) {
      setLocalError("Choose a client or add a new one.");
      return;
    }
    if (!draft.items.length) {
      setLocalError("Add at least one line item.");
      return;
    }
    const payload = JSON.stringify(draft);
    if (previousSubmission.current?.payload !== payload) previousSubmission.current = { payload, key: crypto.randomUUID() };
    const submitted = { ...draft, idempotencyKey: previousSubmission.current.key };
    const validated = invoiceDraftActionInput(submitted);
    // Demo fixtures use local IDs. The server validates UUIDs for live submissions.
    if ((validated.clientId?.match(/^[0-9a-f-]{36}$/i) || validated.inlineClient)) {
      const parsed = invoiceDraftSchema.safeParse(validated);
      if (!parsed.success) {
        setLocalError(parsed.error.issues[0]?.message ?? "Check the invoice details.");
        return;
      }
    }
    void onSave(submitted);
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      {sourceQuote ? <p className="form-banner">From quote {sourceQuote.documentNumber || sourceQuote.id}</p> : null}
      {draft.replacesInvoiceId ? (
        <>
          <p className="form-banner">Issuing this replacement voids the original invoice and keeps both records linked.</p>
          <Field label="Reason for replacement" required>
            <textarea value={draft.correctionReason ?? ""} onChange={(event) => setField("correctionReason", event.target.value)}
              required maxLength={1000} rows={2} disabled={pending} />
          </Field>
        </>
      ) : null}
      {currentInvoice?.duplicateSource ? <p className="form-banner">Review needed. This invoice shares work with another historical invoice.</p> : null}
      <EntityPicker
        label="Client" value={draft.clientId} onChange={selectClient}
        options={rankedClients(clients).map((client) => ({
          id: client.id, label: client.name, keywords: `${client.email} ${client.phone} ${client.properties.map((site) => site.address).join(" ")}`,
        }))}
        placeholder="Choose a client" filterPlaceholder="Search clients" disabled={pending || sourceLocked}
      />
      {!sourceLocked && !draft.requestId && !draft.jobId ? (
        <fieldset disabled={pending} className="invoice-client-add">
          <InlineClientFields value={draft.inlineClient} onChange={setInlineClient} clients={clients}
            onSelectExisting={(client) => selectClient(client.id)} />
        </fieldset>
      ) : null}
      <div className="form-grid form-grid--two">
        <EntityPicker
          label="Job Request" value={draft.requestId ?? ""} onChange={selectRequest}
          options={eligibleRequests.map((request) => ({
            id: request.id, label: `${request.client} · ${request.scope || request.category}`, keywords: request.address,
          }))}
          placeholder="No job request" filterPlaceholder="Search requests" disabled={pending || sourceLocked || !!draft.inlineClient}
        />
        <EntityPicker
          label="Completed visit" value={draft.jobId ?? ""} onChange={selectJob}
          options={eligibleJobs.map((job) => ({ id: job.id, label: formatWorkLabel(job), keywords: `${job.address} ${job.scope}` }))}
          placeholder="No completed visit" filterPlaceholder="Search completed visits"
          disabled={pending || Boolean(draft.sourceLocked) || !!draft.inlineClient} required={requiresVisit}
        />
      </div>
      {requiresVisit ? <p className="form-banner">This request has visits. Choose a completed visit to invoice.</p> : null}
      {conflict ? (
        <div className="form-banner">
          <p>An invoice already covers this work.</p>
          {onViewExisting ? <Button type="button" variant="secondary" onClick={() => onViewExisting(conflict)}>Open {conflict.documentNumber ?? "existing invoice"}</Button> : null}
        </div>
      ) : null}
      {selectedClient?.properties.length ? (
        <details open={draft.propertyId || draft.extraPropertyIds?.length ? true : undefined}>
          <summary>Service sites</summary>
          <Field label="Primary service site">
            <select value={draft.propertyId} onChange={(event) => setField("propertyId", event.target.value)} disabled={pending}>
              <option value="">No service site</option>
              {selectedClient.properties.filter((site) => site.id).map((site) => <option value={site.id} key={site.id}>{site.address}</option>)}
            </select>
          </Field>
          {selectedClient.properties.filter((site) => site.id && site.id !== draft.propertyId).map((site) => (
            <label key={site.id} className="checkbox-row">
              <input type="checkbox" checked={draft.extraPropertyIds?.includes(site.id!) ?? false} disabled={pending}
                onChange={(event) => setField("extraPropertyIds", event.target.checked
                  ? [...(draft.extraPropertyIds ?? []), site.id!] : draft.extraPropertyIds?.filter((id) => id !== site.id))} />
              <span>{site.address}</span>
            </label>
          ))}
        </details>
      ) : null}
      <Field label="Scope of work">
        <textarea rows={3} value={draft.scope ?? ""} onChange={(event) => setField("scope", event.target.value)} disabled={pending} maxLength={20_000} />
      </Field>
      <LineItemEditor items={draft.items} setItems={(update) => setDraft((current) => ({
        ...current, items: typeof update === "function" ? update(current.items) : update,
      }))} rateChips={rateChips} invoice disabled={pending} />
      <div className="totals-block"><div className="totals-block__total">
        <span>Invoice total</span>
        <strong>{money(draft.items.reduce((sum, item) => sum + Math.round(invoiceLineTotal(item) * 100), 0) / 100)}</strong>
      </div></div>
      <div className="form-grid form-grid--three">
        <Field label="Issue date" required>
          <input type="date" required value={draft.issueDate ?? ""} disabled={pending} onChange={(event) => setField("issueDate", event.target.value)} />
        </Field>
        <Field label="Due date">
          <input type="date" min={draft.issueDate} value={draft.dueDate ?? ""} disabled={pending} onChange={(event) => setField("dueDate", event.target.value)} />
        </Field>
        <Field label="Service date">
          <input type="date" value={draft.serviceDate ?? ""} disabled={pending} onChange={(event) => setField("serviceDate", event.target.value)} />
        </Field>
      </div>
      <div className="dialog-actions">
        {[7, 14, 30].map((days) => (
          <Button key={days} variant="secondary" type="button" disabled={pending || !draft.issueDate}
            onClick={() => setField("dueDate", addDays(draft.issueDate!, days))}>Net {days}</Button>
        ))}
      </div>
      <Field label="Notes to client">
        <textarea rows={2} value={draft.notes} onChange={(event) => setField("notes", event.target.value)} disabled={pending} maxLength={20_000} />
      </Field>
      <details>
        <summary>Billing details and notes</summary>
        <div className="form-grid form-grid--two">
          <Field label="Billing name"><input value={draft.billingName ?? ""} maxLength={160} disabled={pending} onChange={(event) => setField("billingName", event.target.value)} /></Field>
          <Field label="Reference or PO"><input value={draft.reference ?? ""} maxLength={160} disabled={pending} onChange={(event) => setField("reference", event.target.value)} /></Field>
          <Field label="Recipient name"><input value={draft.recipientName ?? ""} maxLength={160} disabled={pending} onChange={(event) => setField("recipientName", event.target.value)} /></Field>
          <Field label="Recipient email"><input value={draft.recipientEmail ?? ""} type="email" maxLength={320} disabled={pending} onChange={(event) => setField("recipientEmail", event.target.value)} /></Field>
        </div>
        <Field label="Billing address"><textarea value={draft.billingAddress ?? ""} maxLength={1000} disabled={pending} onChange={(event) => setField("billingAddress", event.target.value)} rows={2} /></Field>
        <Field label="Payment terms"><textarea value={draft.terms ?? ""} maxLength={20_000} disabled={pending} onChange={(event) => setField("terms", event.target.value)} rows={2} /></Field>
        <Field label="Payment instructions"><textarea value={draft.paymentInstructions ?? ""} maxLength={20_000} disabled={pending} onChange={(event) => setField("paymentInstructions", event.target.value)} rows={2} /></Field>
        <Field label="Internal notes"><textarea value={draft.internalNotes ?? ""} maxLength={20_000} disabled={pending} onChange={(event) => setField("internalNotes", event.target.value)} rows={2} /></Field>
      </details>
      {localError || error ? <p className="form-error" role="alert">{localError || error}</p> : null}
      <div className="dialog-actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button icon={Save} type="submit" disabled={pending || !!conflict || requiresVisit}>
          {pending ? "Saving…" : draft.id ? "Save changes" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
