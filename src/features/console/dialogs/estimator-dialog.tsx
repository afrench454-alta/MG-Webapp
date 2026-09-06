"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { JobRequest, LineItem } from "../domain";
import { money, quoteTotals } from "../domain";
import {
  estimateToLineItems,
  type EstimateJobAction,
  type EstimateResult,
} from "../data/estimator-contract";
import { formatWorkLabel } from "../data/work-identity";
import {
  detailsForCategory,
  isServiceCategory,
  parseServiceTitle,
  serviceCatalog,
  summarizeServiceCategory,
  type ServiceCategory,
} from "../data/service-catalog";
import { Button, Field } from "../components/ui-elements";

export function EstimatorDialog({
  requests = [],
  initialRequestId = "",
  onClose,
  onEstimate,
  onUseQuote,
}: {
  requests?: JobRequest[];
  initialRequestId?: string;
  onClose: () => void;
  onEstimate?: EstimateJobAction;
  onUseQuote?: (payload: {
    jobRequestId?: string;
    scope: string;
    items: LineItem[];
  }) => void;
}) {
  const initial = requests.find((request) => request.id === initialRequestId);
  const parsedInitial = initial ? parseServiceTitle(initial.category) : null;
  const [category, setCategory] = useState<ServiceCategory>(
    parsedInitial && isServiceCategory(parsedInitial.category)
      ? parsedInitial.category
      : "Cleaning Services",
  );
  const [detail, setDetail] = useState(parsedInitial?.detail || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [scope, setScope] = useState(initial?.scope || "");
  const [jobRequestId, setJobRequestId] = useState(initialRequestId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const details = detailsForCategory(category);

  const runEstimate = async () => {
    setError("");
    if (!onEstimate) {
      setError(
        "AI quoting is not connected on this deployment yet. Build the quote by hand.",
      );
      return;
    }
    setPending(true);
    const result = await onEstimate({
      category,
      serviceDetail: detail || undefined,
      address: address || undefined,
      scope,
      jobRequestId: /^[0-9a-f-]{36}$/i.test(jobRequestId)
        ? jobRequestId
        : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEstimate(result.estimate);
  };

  const items = estimate ? estimateToLineItems(estimate) : [];
  const totals = items.length ? quoteTotals(items) : null;

  return (
    <form
      className="estimator-form"
      onSubmit={(event) => {
        event.preventDefault();
        void runEstimate();
      }}
    >
      {requests.length ? (
        <Field label="Prefill from job request">
          <select
            value={jobRequestId}
            onChange={(event) => {
              const selected = requests.find(
                (request) => request.id === event.target.value,
              );
              setJobRequestId(event.target.value);
              if (!selected) return;
              setAddress(selected.address);
              if (!scope) setScope(selected.scope);
              const parsed = parseServiceTitle(selected.category);
              if (isServiceCategory(parsed.category)) {
                setCategory(parsed.category);
                setDetail(parsed.detail || "");
              }
            }}
            disabled={pending}
          >
            <option value="">Start from a blank brief</option>
            {requests.map((request) => (
              <option value={request.id} key={request.id}>
                {formatWorkLabel(request)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="form-grid form-grid--two">
        <Field
          label="Service"
          hint={summarizeServiceCategory(category) || undefined}
        >
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ServiceCategory);
              setDetail("");
            }}
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
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            disabled={pending}
          >
            <option value="">Any / not specified</option>
            {details.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Property address">
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, suburb"
          disabled={pending}
        />
      </Field>
      <Field label="Scope description" required>
        <textarea
          rows={4}
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          placeholder="Describe the job in plain English. e.g. General clean of 3-bed 2-bath. Inside oven and interior windows too."
          required
          disabled={pending}
        />
      </Field>
      <Button
        type="submit"
        className="estimator-submit"
        icon={Sparkles}
        disabled={pending || scope.trim().length < 8}
      >
        {pending ? "Estimating…" : "Draft quote with AI"}
      </Button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {estimate ? (
        <section className="estimate-result">
          <p className="eyebrow">Draft for review</p>
          <p>{estimate.summary}</p>
          {estimate.assumptions ? (
            <p className="muted-copy">{estimate.assumptions}</p>
          ) : null}
          <ul>
            {items.map((item, index) => (
              <li key={`${item.description}-${index}`}>
                <span>
                  {item.description}
                  <small>
                    {item.quantity} {item.unitLabel} × {money(Number(item.rate))}
                  </small>
                </span>
                <strong>
                  {money(Number(item.quantity) * Number(item.rate))}
                </strong>
              </li>
            ))}
          </ul>
          {totals ? (
            <p className="estimate-total">
              Suggested total <strong>{money(totals.total)}</strong>
            </p>
          ) : null}
          {onUseQuote ? (
            <Button
              type="button"
              onClick={() =>
                onUseQuote({
                  jobRequestId: jobRequestId || undefined,
                  scope: estimate.summary,
                  items,
                })
              }
            >
              Use on a quote
            </Button>
          ) : null}
        </section>
      ) : null}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}
