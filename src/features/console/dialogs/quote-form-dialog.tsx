"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Save, Sparkles } from "lucide-react";
import type { JobRequest, LineItem } from "../domain";
import {
  estimateToLineItems,
  type EstimateJobAction,
} from "../data/estimator-contract";
import { isServiceCategory, parseServiceTitle } from "../data/service-catalog";
import { formatWorkLabel } from "../data/work-identity";
import { Button, Field } from "../components/ui-elements";
import { LineItemEditor, Totals } from "../components/line-item-editor";

export type QuoteDraft = {
  id?: string;
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
  onEstimate,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  prefill?: Partial<QuoteDraft>;
  onClose: () => void;
  onSave: (draft: QuoteDraft) => void | Promise<void>;
  onEstimate?: EstimateJobAction;
  pending?: boolean;
  error?: string;
}) {
  const editing = Boolean(prefill?.id);
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
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  const selected = requests.find((request) => request.id === jobRequestId);

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
    if (!jobRequestId || !scope || items.some((item) => !item.description))
      return;
    void onSave({
      id: prefill?.id,
      jobRequestId,
      scope,
      items,
      clientNotes,
      internalNotes,
    });
  };

  const busy = pending || estimating;

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={busy}>
      <Field label="Job request" required>
        <select
          value={jobRequestId}
          onChange={(event) => {
            const next = requests.find(
              (request) => request.id === event.target.value,
            );
            setJobRequestId(event.target.value);
            if (next && !scope) setScope(next.scope);
          }}
          required
          disabled={busy || editing}
        >
          <option value="">Choose...</option>
          {requests.map((request) => (
            <option value={request.id} key={request.id}>
              {formatWorkLabel({
                ...request,
                date: request.scheduled || request.created,
              })}
            </option>
          ))}
        </select>
      </Field>
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
      <LineItemEditor items={items} setItems={setItems} />
      <Totals items={items} />
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
