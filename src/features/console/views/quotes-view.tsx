"use client";

import { useMemo, useState } from "react";
import { DollarSign, Eye, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { money, quoteTotals, type Invoice, type Quote } from "../domain";
import {
  countMatching,
  matchesQuoteFilter,
  quoteFilterIds,
  type QuoteFilterId,
} from "../data/list-filters";
import {
  canCreateInvoiceFromQuote,
  liveInvoiceForQuote,
} from "../data/quote-invoice";
import {
  Badge,
  Button,
  EmptyState,
  FilterGroup,
  IconButton,
  matchesText,
  PageHeader,
  quoteStatusTone,
} from "../components/ui-elements";
import { formatSiteTitle } from "../data/work-identity";

export function QuotesView({
  quotes,
  invoices,
  onNew,
  onView,
  onEstimate,
  onCreateInvoice,
  onViewInvoice,
  onDelete,
}: {
  quotes: Quote[];
  invoices: Invoice[];
  onNew: () => void;
  onView: (quote: Quote) => void;
  onEstimate: () => void;
  onCreateInvoice: (quote: Quote) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onDelete: (quote: Quote) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuoteFilterId>("live");
  const counts = useMemo(
    () => countMatching(quotes, quoteFilterIds, matchesQuoteFilter),
    [quotes],
  );

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
    return matchesText(searchable, query) && matchesQuoteFilter(quote, filter);
  });

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Quotes"
        subtitle="14-day validity · No GST applied. Accepted quotes can prefill an invoice."
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
          <FilterGroup
            label="Quote view"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "live", label: "All", count: counts.live },
              { id: "open", label: "Open", count: counts.open },
              { id: "accepted", label: "Accepted", count: counts.accepted },
              { id: "voided", label: "Voided", count: counts.voided },
            ]}
          />
        </div>
      </section>
      <section className="record-list">
        {visible.map((quote) => {
          const totals = quoteTotals(quote.items);
          const existingInvoice = liveInvoiceForQuote(quote, invoices);
          return (
            <article className="record-row" key={quote.id}>
              <div>
                <div className="title-with-badge">
                  <h2>{quote.documentNumber || quote.id}</h2>
                  <Badge tone={quoteStatusTone(quote.status)}>
                    {quote.status}
                  </Badge>
                </div>
                <strong className="record-client">{formatSiteTitle(quote)}</strong>
                <p>
                  Issued {quote.issued} · Expires {quote.expires}
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
                {existingInvoice ? (
                  <Button
                    variant="secondary"
                    icon={DollarSign}
                    onClick={() => onViewInvoice(existingInvoice)}
                  >
                    View invoice
                  </Button>
                ) : canCreateInvoiceFromQuote(quote) ? (
                  <Button
                    icon={DollarSign}
                    onClick={() => onCreateInvoice(quote)}
                  >
                    Create invoice
                  </Button>
                ) : null}
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
          <EmptyState
            title={
              filter === "voided"
                ? "No voided quotes."
                : "No quotes match the current filters."
            }
          />
        ) : null}
      </section>
    </>
  );
}
