"use client";

import { useState } from "react";
import { ChevronDown, Eye, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { money, quoteTotals, type Quote } from "../domain";
import { Badge, Button, EmptyState, IconButton, matchesText, PageHeader, quoteStatusTone } from "../components/ui-elements";

export function QuotesView({
  quotes,
  onNew,
  onView,
  onEstimate,
  onDelete,
}: {
  quotes: Quote[];
  onNew: () => void;
  onView: (quote: Quote) => void;
  onEstimate: () => void;
  onDelete: (quote: Quote) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Quote["status"]>("All");

  const visible = quotes.filter((quote) => {
    const searchable = [
      quote.id,
      quote.documentNumber,
      quote.client,
      quote.address,
      quote.issued,
      quote.expires,
      quote.scope,
      quote.clientNotes,
    ].join(" ");
    return (
      matchesText(searchable, query) &&
      (status === "All" || quote.status === status)
    );
  });

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Quotes"
        subtitle="14-day validity · No GST applied."
      >
        <Button variant="secondary" icon={Sparkles} onClick={onEstimate}>
          AI Estimator
        </Button>
        <Button icon={Plus} onClick={onNew}>
          New Quote
        </Button>
      </PageHeader>
      <section className="list-filters" aria-label="Quote filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search quotes</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
          />
        </label>
        <div className="filter-controls">
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select" aria-label="Quote status filter">
            <span className="sr-only">Quote status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | Quote["status"])
              }
            >
              <option value="All">All statuses</option>
              <option>Draft</option>
              <option>Sent</option>
              <option>Accepted</option>
              <option>Declined</option>
              <option>Expired</option>
              <option>Void</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        </div>
      </section>
      <section className="record-list">
        {visible.map((quote) => {
          const totals = quoteTotals(quote.items);
          return (
            <article className="record-row" key={quote.id}>
              <div>
                <div className="title-with-badge">
                  <h2>{quote.documentNumber || quote.id}</h2>
                  <Badge tone={quoteStatusTone(quote.status)}>
                    {quote.status}
                  </Badge>
                </div>
                <strong className="record-client">{quote.client}</strong>
                <p>
                  {quote.address} · Issued {quote.issued} · Expires{" "}
                  {quote.expires}
                </p>
              </div>
              <div className="record-row__actions">
                <div className="amount-block">
                  <strong>{money(totals.total)}</strong>
                  <small>NO GST</small>
                </div>
                <Button
                  variant="secondary"
                  icon={Eye}
                  onClick={() => onView(quote)}
                >
                  View
                </Button>
                <IconButton
                  label={`Delete ${quote.documentNumber || quote.id}`}
                  icon={Trash2}
                  tone="danger"
                  onClick={() => onDelete(quote)}
                />
              </div>
            </article>
          );
        })}
        {!visible.length ? (
          <EmptyState title="No quotes match the current filters." />
        ) : null}
      </section>
    </>
  );
}
