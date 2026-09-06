"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Save } from "lucide-react";
import type { JobRequest, LineItem } from "../domain";
import { formatWorkLabel } from "../data/work-identity";
import { Button, Field } from "../components/ui-elements";
import { LineItemEditor, Totals } from "../components/line-item-editor";

export type QuoteDraft = {
  jobRequestId: string;
  scope: string;
  items: LineItem[];
  clientNotes: string;
  internalNotes: string;
};

export function QuoteFormDialog({
  requests,
  prefill,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  prefill?: Partial<QuoteDraft>;
  onClose: () => void;
  onSave: (draft: QuoteDraft) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [jobRequestId, setJobRequestId] = useState(prefill?.jobRequestId || "");
  const [scope, setScope] = useState(prefill?.scope || "");
  const [items, setItems] = useState<LineItem[]>(
    prefill?.items?.length
      ? prefill.items.map((item) => ({ ...item }))
      : [{ description: "", quantity: 1, rate: 0 }],
  );
  const [clientNotes, setClientNotes] = useState(
    prefill?.clientNotes ||
      "Please contact us if you wish to amend any items on this quote.",
  );
  const [internalNotes, setInternalNotes] = useState(
    prefill?.internalNotes || "",
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobRequestId || !scope || items.some((item) => !item.description))
      return;
    void onSave({ jobRequestId, scope, items, clientNotes, internalNotes });
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <Field label="Job request" required>
        <select
          value={jobRequestId}
          onChange={(event) => {
            const selected = requests.find(
              (request) => request.id === event.target.value,
            );
            setJobRequestId(event.target.value);
            if (selected && !scope) setScope(selected.scope);
          }}
          required
          disabled={pending}
        >
          <option value="">Choose...</option>
          {requests.map((request) => (
            <option value={request.id} key={request.id}>
              {formatWorkLabel(request)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Scope summary" required>
        <input
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          required
        />
      </Field>
      <LineItemEditor items={items} setItems={setItems} />
      <Totals items={items} />
      <div className="form-grid form-grid--two">
        <Field label="Client notes">
          <textarea
            rows={4}
            value={clientNotes}
            onChange={(event) => setClientNotes(event.target.value)}
          />
        </Field>
        <Field label="Internal notes">
          <textarea
            rows={4}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
          />
        </Field>
      </div>
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
          {pending ? "Saving…" : "Save Quote"}
        </Button>
      </div>
    </form>
  );
}
