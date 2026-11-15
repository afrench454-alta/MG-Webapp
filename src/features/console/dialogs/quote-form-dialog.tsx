"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Save, Sparkles } from "lucide-react";
import { quoteTerms, type Client, type Invoice, type JobRequest, type LineItem, type Quote } from "../domain";
import type { InlineClientInput } from "../data/inline-client";
import {
  estimateToLineItems,
  type EstimateJobAction,
} from "../data/estimator-contract";
import { buildClientRateChips } from "../data/form-options";
import { isServiceCategory, parseServiceTitle } from "../data/service-catalog";
import { brisbaneDateKey, formatWorkLabel } from "../data/work-identity";
import { Button, Field } from "../components/ui-elements";
import { InlineClientFields } from "../components/inline-client-fields";
import { LineItemEditor, Totals } from "../components/line-item-editor";

export type QuoteDraft = {
  id?: string;
  jobRequestId?: string;
  clientId?: string;
  propertyId?: string;
  inlineClient?: InlineClientInput;
  issueDate?: string;
  validUntil?: string | null;
  reference?: string;
  terms?: string;
  updatedAt?: string;
  scope: string;
  items: LineItem[];
  clientNotes: string;
  internalNotes: string;
};

export function QuoteFormDialog({
  requests,
  clients = [],
  quotes = [],
  invoices = [],
  prefill,
  onClose,
  onSave,
  onEstimate,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  clients?: Client[];
  quotes?: Quote[];
  invoices?: Invoice[];
  prefill?: Partial<QuoteDraft>;
  onClose: () => void;
  onSave: (draft: QuoteDraft) => void | Promise<void>;
  onEstimate?: EstimateJobAction;
  pending?: boolean;
  error?: string;
}) {
  const editing = Boolean(prefill?.id);
  const [jobRequestId, setJobRequestId] = useState(prefill?.jobRequestId || "");
  const [clientId, setClientId] = useState(prefill?.clientId || "");
  const [propertyId, setPropertyId] = useState(prefill?.propertyId || "");
  const [inlineClient, setInlineClient] = useState(prefill?.inlineClient);
  const [issueDate, setIssueDate] = useState(() => prefill?.issueDate || brisbaneDateKey());
  const [validUntil, setValidUntil] = useState(() =>
    prefill?.validUntil === null ? "" : prefill?.validUntil ?? brisbaneDateKey(new Date(Date.now() + 14 * 86_400_000)),
  );
  const [reference, setReference] = useState(prefill?.reference ?? "");
  const [terms, setTerms] = useState(prefill?.terms ?? quoteTerms);
  const [scope, setScope] = useState(prefill?.scope || "");
  const [items, setItems] = useState<LineItem[]>(
    prefill?.items?.length
      ? prefill.items.map((item) => ({ ...item }))
      : [{ description: "", quantity: 1, rate: 0 }],
  );
  const [clientNotes, setClientNotes] = useState(
    prefill?.clientNotes ??
      "Please contact us if you wish to amend any items on this quote.",
  );
  const [internalNotes, setInternalNotes] = useState(
    prefill?.internalNotes || "",
  );
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  const selected = requests.find((request) => request.id === jobRequestId);
  const selectedClient = clients.find((client) => client.id === clientId);
  const requestOptions = requests.filter((request) => Boolean(request.clientId)
    && (request.id === jobRequestId || (request.status !== "Closed" && request.status !== "Rejected")));
  const selectClient = (client: Client | undefined) => {
    setClientId(client?.id ?? "");
    setPropertyId("");
    setInlineClient(undefined);
  };

  const rateChips = useMemo(
    () =>
      buildClientRateChips({
        client: selected
          ? { id: selected.clientId, name: selected.client }
          : selectedClient,
        quotes,
        invoices,
      }),
    [selected, selectedClient, quotes, invoices],
  );

  const suggestWithAi = async () => {
    setEstimateError("");
    if (!onEstimate) {
      setEstimateError(
        "AI quoting is not connected on this deployment yet. Build the quote by hand.",
      );
      return;
    }
    if (!selected) {
      setEstimateError("Choose a job request first so the estimate has a brief.");
      return;
    }
    const parsed = parseServiceTitle(selected.category);
    const category = isServiceCategory(parsed.category)
      ? parsed.category
      : "Cleaning Services";
    setEstimating(true);
    const result = await onEstimate({
      category,
      serviceDetail: parsed.detail,
      address: selected.address,
      scope: scope.trim() || selected.scope,
      jobRequestId: selected.id,
    });
    setEstimating(false);
    if (!result.ok) {
      setEstimateError(result.message);
      return;
    }
    setItems(estimateToLineItems(result.estimate));
    if (!scope.trim() || scope.trim() === selected.scope.trim()) {
      setScope(result.estimate.summary);
    }
    if (result.estimate.assumptions && !internalNotes.trim()) {
      setInternalNotes(result.estimate.assumptions);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!jobRequestId && !clientId && !inlineClient?.name.trim()) || !scope.trim()
      || items.some((item) => !item.description.trim()))
      return;
    void onSave({
      id: prefill?.id,
      jobRequestId: jobRequestId || undefined,
      clientId: jobRequestId || inlineClient ? undefined : clientId,
      propertyId: jobRequestId || inlineClient ? undefined : propertyId || undefined,
      inlineClient: jobRequestId ? undefined : inlineClient,
      updatedAt: prefill?.updatedAt,
      issueDate,
      validUntil: validUntil || null,
      reference,
      terms,
      scope,
      items,
      clientNotes,
      internalNotes,
    });
  };

  const busy = pending || estimating;

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={busy}>
      {requestOptions.length || jobRequestId ? (
      <Field label="Job Request">
        <select
          value={jobRequestId}
          onChange={(event) => {
            const next = requests.find(
              (request) => request.id === event.target.value,
            );
            setJobRequestId(event.target.value);
            if (next) selectClient(undefined);
            if (next && !scope) setScope(next.scope);
          }}
          disabled={busy || Boolean(editing && prefill?.jobRequestId)}
        >
          <option value="">No job request</option>
          {requestOptions.map((request) => (
            <option value={request.id} key={request.id}>
              {formatWorkLabel({
                ...request,
                date: request.scheduled || request.created,
              })}
            </option>
          ))}
        </select>
      </Field>
      ) : null}
      {!jobRequestId ? (
        <fieldset className="form-stack" disabled={busy}>
          {!inlineClient ? (
            <>
              <Field label="Client" required>
                <select value={clientId} required onChange={(event) => selectClient(clients.find((client) => client.id === event.target.value))}>
                  <option value="">Choose a client</option>
                  {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
                  {clientId && !selectedClient ? <option value={clientId}>Current client</option> : null}
                </select>
              </Field>
              {selectedClient?.properties.length || propertyId ? (
                <Field label="Service address">
                  <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                    <option value="">No service address</option>
                    {selectedClient?.properties.filter((property) => property.id).map((property) => (
                      <option value={property.id} key={property.id}>{property.address}</option>
                    ))}
                    {propertyId && !selectedClient?.properties.some((property) => property.id === propertyId)
                      ? <option value={propertyId}>Current service address</option> : null}
                  </select>
                </Field>
              ) : null}
            </>
          ) : null}
          <InlineClientFields value={inlineClient} onChange={setInlineClient} clients={clients} onSelectExisting={selectClient} />
        </fieldset>
      ) : null}
      <Field label="Scope summary" required>
        <input
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          required
          disabled={busy}
        />
      </Field>
      {onEstimate ? (
        <div className="dialog-actions" style={{ justifyContent: "flex-start" }}>
          <Button
            type="button"
            variant="secondary"
            icon={Sparkles}
            onClick={() => void suggestWithAi()}
            disabled={busy || !jobRequestId}
          >
            {estimating ? "Estimating…" : "Suggest with AI"}
          </Button>
        </div>
      ) : null}
      <LineItemEditor
        items={items}
        setItems={setItems}
        rateChips={rateChips}
        onApplyRateChip={(chip) => {
          if (!scope.trim()) {
            setScope(chip.description);
          }
        }}
      />
      <Totals items={items} />
      <div className="form-grid form-grid--two">
        <Field label="Issue date" required>
          <input type="date" value={issueDate} required onChange={(event) => setIssueDate(event.target.value)} disabled={busy} />
        </Field>
        <Field label="Valid until">
          <input type="date" min={issueDate} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} disabled={busy} />
        </Field>
      </div>
      <Field label="Customer reference">
        <input value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} disabled={busy} />
      </Field>
      <div className="form-grid form-grid--two">
        <Field label="Client notes">
          <textarea
            rows={4}
            value={clientNotes}
            onChange={(event) => setClientNotes(event.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label="Internal notes">
          <textarea
            rows={4}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            disabled={busy}
          />
        </Field>
      </div>
      <Field label="Quote terms">
        <textarea rows={3} value={terms} onChange={(event) => setTerms(event.target.value)} disabled={busy} />
      </Field>
      {estimateError || error ? (
        <p className="form-error" role="alert">
          {estimateError || error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button icon={Save} type="submit" disabled={busy}>
          {pending ? "Saving…" : editing ? "Save changes" : "Save Quote"}
        </Button>
      </div>
    </form>
  );
}
