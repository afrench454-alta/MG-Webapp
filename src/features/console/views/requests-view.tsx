"use client";

import { useMemo, useState } from "react";
import { MapPin, Plus, ReceiptText, Search, Sparkles, Trash2 } from "lucide-react";
import type { JobRequest } from "../domain";
import {
  countMatching,
  matchesRequestFilter,
  requestFilterIds,
  type RequestFilterId,
} from "../data/list-filters";
import {
  Badge,
  Button,
  EmptyState,
  FilterGroup,
  IconButton,
  matchesText,
  PageHeader,
} from "../components/ui-elements";

export function RequestsView({
  requests,
  onCreate,
  onQuote,
  onEstimate,
  onDelete,
  canManage,
}: {
  requests: JobRequest[];
  onCreate: () => void;
  onQuote: (request: JobRequest) => void;
  onEstimate: () => void;
  onDelete: (request: JobRequest) => void;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RequestFilterId>("all");
  const counts = useMemo(
    () => countMatching(requests, requestFilterIds, matchesRequestFilter),
    [requests],
  );

  const visible = requests.filter((request) => {
    const searchable = [
      request.client,
      request.address,
      request.category,
      request.scope,
      request.created,
    ].join(" ");
    return (
      matchesText(searchable, query) && matchesRequestFilter(request, filter)
    );
  });

  return (
    <>
      <PageHeader
        eyebrow="Intake"
        title="Job Requests"
        subtitle="Log scope, site visits and quote intent per property."
      >
        {canManage ? (
          <Button icon={Plus} onClick={onCreate}>
            New Request
          </Button>
        ) : null}
      </PageHeader>
      <section className="list-filters" aria-label="Job request filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search job requests</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
          />
        </label>
        <div className="filter-controls">
          <FilterGroup
            label="Request view"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "open", label: "Open", count: counts.open },
              { id: "scheduled", label: "Scheduled", count: counts.scheduled },
              { id: "closed", label: "Closed", count: counts.closed },
            ]}
          />
        </div>
      </section>
      {visible.length ? (
        visible.map((request) => (
          <article className="request-card" key={request.id}>
            <div className="request-card__main">
              <div className="title-with-badge request-title">
                <Badge tone="sage">{request.category}</Badge>
                <h2>{request.client}</h2>
                <Badge>{request.status}</Badge>
              </div>
              <p className="location-line">
                <MapPin aria-hidden="true" size={17} /> {request.address}
              </p>
              <p className="request-scope">{request.scope}</p>
              <p className="request-dates">
                Created {request.created}
                {request.scheduled ? ` · Scheduled ${request.scheduled}` : ""}
                {request.visit ? ` · Visit ${request.visit}` : ""}
              </p>
            </div>
            <div className="request-card__actions">
              <Button
                variant="secondary"
                icon={ReceiptText}
                onClick={() => onQuote(request)}
              >
                Create quote
              </Button>
              <button
                className="ai-secondary"
                type="button"
                onClick={onEstimate}
              >
                <Sparkles aria-hidden="true" size={17} /> AI estimate
              </button>
              {canManage ? (
                <IconButton
                  label={`Delete request for ${request.client}`}
                  icon={Trash2}
                  tone="danger"
                  onClick={() => onDelete(request)}
                />
              ) : null}
            </div>
          </article>
        ))
      ) : (
        <EmptyState
          title={
            requests.length
              ? "No job requests match the current filters."
              : "No job requests yet."
          }
          action={
            !requests.length && canManage
              ? "Create the first request"
              : undefined
          }
          onAction={!requests.length && canManage ? onCreate : undefined}
        />
      )}
    </>
  );
}
