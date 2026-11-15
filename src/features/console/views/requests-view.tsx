"use client";

import { useMemo, useState } from "react";
import { MapPin, Plus, ReceiptText, Search } from "lucide-react";
import type { JobRequest } from "../domain";
import {
  countMatching,
  matchesRequestFilter,
  requestFilterIds,
  type RequestFilterId,
} from "../data/list-filters";
import { displayServiceCategory, displayServiceDetail } from "../data/service-catalog";
import { formatSiteTitle } from "../data/work-identity";
import {
  Badge,
  Button,
  EmptyState,
  FilterGroup,
  matchesText,
  PageHeader,
} from "../components/ui-elements";

export function RequestsView({
  requests,
  onCreate,
  onQuote,
  onSetClosed,
  stageError,
  invoiceAction,
  canManage,
}: {
  requests: JobRequest[];
  onCreate: () => void;
  onQuote: (request: JobRequest) => void;
  onDelete?: (request: JobRequest) => void;
  onSetClosed?: (request: JobRequest, closed: boolean) => void;
  stageError?: string;
  invoiceAction?: (request: JobRequest) => { label: string; run: () => void } | undefined;
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
      {stageError ? <p className="form-error" role="alert">{stageError}</p> : null}
      {visible.length ? (
        visible.map((request) => {
          const serviceType = displayServiceDetail(request.category);
          const invoice = invoiceAction?.(request);
          return (
          <article className="request-card" key={request.id}>
            <div className="request-card__main">
              <div className="title-with-badge request-title">
                <Badge tone="sage">{displayServiceCategory(request.category)}</Badge>
                {serviceType ? <Badge>{serviceType}</Badge> : null}
                <h2>{formatSiteTitle(request)}</h2>
                <Badge>{request.status}</Badge>
              </div>
              <p className="location-line">
                <MapPin aria-hidden="true" size={17} /> {request.address}
              </p>
              <p className="request-scope"><strong>Job Request</strong><br />{request.scope}</p>
              <p className="request-dates">
                Created {request.created}
                {request.scheduled ? ` · Scheduled ${request.scheduled}` : ""}
                {request.visit ? ` · Visit ${request.visit}` : ""}
              </p>
            </div>
            <div className="request-card__actions">
              {canManage ? (
                <>
                  {invoice ? <Button variant="secondary" onClick={invoice.run}>{invoice.label}</Button> : null}
                  {request.status !== "Closed" && request.status !== "Rejected" ? (
                    <Button variant="secondary" icon={ReceiptText} onClick={() => onQuote(request)}>
                      Create quote
                    </Button>
                  ) : null}
                  {onSetClosed && request.status !== "Rejected" ? (
                    <Button variant="secondary" onClick={() => onSetClosed(request, request.status !== "Closed")}>
                      {request.status === "Closed" ? "Reopen request" : "Close request"}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </article>
          );
        })
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
