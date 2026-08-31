"use client";

import { useState, useMemo, memo } from "react";
import type { ChangeEvent } from "react";
import { Ban, Check, ChevronDown, Eye, Plus, Search, Send, Trash2, FileCheck2 } from "lucide-react";
import { money, quoteTotals, type Invoice } from "../domain";
import {
  allowedPaymentStatuses,
  canDeleteInvoice,
  canFinalizeInvoice,
  canMarkPaid,
  canMarkSent,
  canVoidInvoice,
  invoiceDisplayStatus,
} from "../data/invoice-lifecycle";
import {
  countMatching,
  invoiceFilterIds,
  matchesInvoiceFilter,
  type InvoiceFilterId,
} from "../data/list-filters";
import {
  Badge,
  Button,
  EmptyState,
  FilterGroup,
  IconButton,
  matchesText,
  PageHeader,
  invoiceDisplayTone,
} from "../components/ui-elements";

const InvoiceRow = memo(function InvoiceRow({
  record,
  pending,
  onView,
  onPaymentStatusChange,
  onFinalize,
  onMarkSent,
  onVoid,
  onDelete,
}: {
  record: Invoice;
  pending: boolean;
  onView: (record: Invoice) => void;
  onPaymentStatusChange: (id: string, status: Invoice["paymentStatus"]) => void;
  onFinalize: (record: Invoice) => void;
  onMarkSent: (record: Invoice) => void;
  onVoid: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const totals = quoteTotals(record.items);
  const display = invoiceDisplayStatus(record);
  const paymentOptions = allowedPaymentStatuses(record);

  const handlePaymentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onPaymentStatusChange(
      record.id,
      event.target.value as Invoice["paymentStatus"],
    );
  };

  return (
    <article className="record-row">
      <div>
        <div className="title-with-badge">
          <h2>{record.documentNumber || record.id}</h2>
          <Badge tone={invoiceDisplayTone(display)}>{display}</Badge>
        </div>
        <strong className="record-client">{record.client}</strong>
        <p>
          {record.address} · Issued {record.issued} · Due {record.due}
        </p>
      </div>
      <div className="record-row__actions">
        <div className="amount-block">
          <strong>{money(totals.total)}</strong>
          <small>NO GST</small>
        </div>
        {paymentOptions.length ? (
          <label className="compact-select">
            <span className="sr-only">
              Payment status for {record.documentNumber || record.id}
            </span>
            <select
              aria-label={`Payment status for ${record.documentNumber || record.id}`}
              value={record.paymentStatus}
              onChange={handlePaymentChange}
              disabled={pending}
            >
              {paymentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        ) : (
          <span className="record-payment-locked">{record.paymentStatus}</span>
        )}
        <Button variant="secondary" icon={Eye} onClick={() => onView(record)} disabled={pending}>
          View
        </Button>
        {canMarkPaid(record) ? (
          <Button
            variant="primary"
            icon={Check}
            onClick={() => onPaymentStatusChange(record.id, "Paid")}
            disabled={pending}
          >
            Mark paid
          </Button>
        ) : null}
        {canFinalizeInvoice(record) ? (
          <Button variant="secondary" icon={FileCheck2} onClick={() => onFinalize(record)} disabled={pending}>
            Issue
          </Button>
        ) : null}
        {canMarkSent(record) ? (
          <Button variant="secondary" icon={Send} onClick={() => onMarkSent(record)} disabled={pending}>
            Mark sent
          </Button>
        ) : null}
        {canVoidInvoice(record) ? (
          <Button variant="secondary" icon={Ban} onClick={() => onVoid(record)} disabled={pending}>
            Void
          </Button>
        ) : null}
        {canDeleteInvoice(record) ? (
          <IconButton
            label={`Delete ${record.documentNumber || record.id}`}
            icon={Trash2}
            tone="danger"
            onClick={() => onDelete(record)}
            disabled={pending}
          />
        ) : null}
      </div>
    </article>
  );
});

export function InvoicesView({
  records,
  pending = false,
  onNew,
  onView,
  onPaymentStatusChange,
  onFinalize,
  onMarkSent,
  onVoid,
  onDelete,
}: {
  records: Invoice[];
  pending?: boolean;
  onNew: () => void;
  onView: (record: Invoice) => void;
  onPaymentStatusChange: (
    invoiceId: string,
    status: Invoice["paymentStatus"],
  ) => void;
  onFinalize: (record: Invoice) => void;
  onMarkSent: (record: Invoice) => void;
  onVoid: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InvoiceFilterId>("live");
  const counts = useMemo(
    () => countMatching(records, invoiceFilterIds, matchesInvoiceFilter),
    [records],
  );

  const visible = useMemo(() => {
    return records.filter((record) => {
      const searchable = [
        record.id,
        record.documentNumber,
        record.client,
        record.address,
        record.issued,
        record.due,
        record.notes,
        ...(record.scope || []),
        ...record.items.map((item) => item.description),
      ].join(" ");
      return (
        matchesText(searchable, query) && matchesInvoiceFilter(record, filter)
      );
    });
  }, [records, query, filter]);

  const outstanding = useMemo(() => {
    return records
      .filter((record) => matchesInvoiceFilter(record, "open"))
      .reduce(
        (sum, record) =>
          sum + quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
        0,
      );
  }, [records]);

  const paid = useMemo(() => {
    return records
      .filter((record) => invoiceDisplayStatus(record) === "Paid")
      .reduce(
        (sum, record) =>
          sum + quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0).total,
        0,
      );
  }, [records]);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        subtitle="Mark paid records a payment and issues a draft in one step. Void unpaid issued invoices. Delete drafts only."
      >
        <div className="billing-summary">
          <span>
            Outstanding: <strong>{money(outstanding)}</strong>
          </span>
          <span>
            Paid: <strong className="success-text">{money(paid)}</strong>
          </span>
        </div>
        <Button icon={Plus} onClick={onNew} disabled={pending}>
          Create Invoice
        </Button>
      </PageHeader>
      <section className="list-filters" aria-label="Invoice filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search invoices</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
          />
        </label>
        <div className="filter-controls">
          <FilterGroup
            label="Invoice view"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "live", label: "All", count: counts.live },
              { id: "open", label: "Open", count: counts.open },
              { id: "paid", label: "Paid", count: counts.paid },
              { id: "voided", label: "Voided", count: counts.voided },
            ]}
          />
        </div>
      </section>
      <section className="record-list">
        {visible.map((record) => (
          <InvoiceRow
            key={record.id}
            record={record}
            pending={pending}
            onView={onView}
            onPaymentStatusChange={onPaymentStatusChange}
            onFinalize={onFinalize}
            onMarkSent={onMarkSent}
            onVoid={onVoid}
            onDelete={onDelete}
          />
        ))}
        {!visible.length ? (
          <EmptyState
            title={
              filter === "voided"
                ? "No voided invoices."
                : "No invoices match the current filters."
            }
          />
        ) : null}
      </section>
    </>
  );
}
