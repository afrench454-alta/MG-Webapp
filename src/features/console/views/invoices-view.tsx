"use client";

import { useState, useMemo, memo } from "react";
import type { ChangeEvent } from "react";
import { ChevronDown, Eye, Plus, Search, Trash2, FileCheck2 } from "lucide-react";
import { money, quoteTotals, type Invoice } from "../domain";
import { Badge, Button, EmptyState, IconButton, matchesText, PageHeader, paymentStatusTone, documentStatusTone } from "../components/ui-elements";

const InvoiceRow = memo(function InvoiceRow({
  record,
  onView,
  onPaymentStatusChange,
  onFinalize,
  onDelete,
}: {
  record: Invoice;
  onView: (record: Invoice) => void;
  onPaymentStatusChange: (id: string, status: Invoice["paymentStatus"]) => void;
  onFinalize: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const totals = quoteTotals(record.items);

  const handlePaymentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onPaymentStatusChange(record.id, event.target.value as Invoice["paymentStatus"]);
  };
  const handleView = () => onView(record);
  const handleFinalize = () => onFinalize(record);
  const handleDelete = () => onDelete(record);

  return (
    <article className="record-row">
      <div>
        <div className="title-with-badge">
          <h2>{record.documentNumber || record.id}</h2>
          <Badge tone={documentStatusTone(record.documentStatus)}>
            {record.documentStatus}
          </Badge>
          <Badge tone={paymentStatusTone(record.paymentStatus)}>
            {record.paymentStatus}
          </Badge>
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
        <label className="compact-select">
          <span className="sr-only">
            Payment status for {record.documentNumber || record.id}
          </span>
          <select
            aria-label={`Payment status for ${record.documentNumber || record.id}`}
            value={record.paymentStatus}
            onChange={handlePaymentChange}
          >
            <option>Unpaid</option>
            <option>Part paid</option>
            <option>Paid</option>
            <option>Void</option>
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        <Button variant="secondary" icon={Eye} onClick={handleView}>
          View
        </Button>
        {record.documentStatus === "Draft" ? (
          <Button variant="primary" icon={FileCheck2} onClick={handleFinalize}>
            Finalize
          </Button>
        ) : null}
        <IconButton
          label={`Delete ${record.documentNumber || record.id}`}
          icon={Trash2}
          tone="danger"
          onClick={handleDelete}
        />
      </div>
    </article>
  );
});

export function InvoicesView({
  records,
  onNew,
  onView,
  onPaymentStatusChange,
  onFinalize,
  onDelete,
}: {
  records: Invoice[];
  onNew: () => void;
  onView: (record: Invoice) => void;
  onPaymentStatusChange: (
    invoiceId: string,
    status: Invoice["paymentStatus"],
  ) => void;
  onFinalize: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [documentStatus, setDocumentStatus] = useState<
    "All" | Invoice["documentStatus"]
  >("All");
  const [paymentStatus, setPaymentStatus] = useState<
    "All" | Invoice["paymentStatus"]
  >("All");

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
        matchesText(searchable, query) &&
        (documentStatus === "All" || record.documentStatus === documentStatus) &&
        (paymentStatus === "All" || record.paymentStatus === paymentStatus)
      );
    });
  }, [records, query, documentStatus, paymentStatus]);

  const outstanding = useMemo(() => {
    return records
      .filter((record) => !["Paid", "Void"].includes(record.paymentStatus))
      .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  }, [records]);

  const paid = useMemo(() => {
    return records
      .filter((record) => record.paymentStatus === "Paid")
      .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  }, [records]);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        subtitle="Due upon completion · 7-day grace period · No GST."
      >
        <div className="billing-summary">
          <span>
            Outstanding: <strong>{money(outstanding)}</strong>
          </span>
          <span>
            Paid: <strong className="success-text">{money(paid)}</strong>
          </span>
        </div>
        <Button icon={Plus} onClick={onNew}>
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
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select">
            <span className="sr-only">Invoice document status</span>
            <select
              value={documentStatus}
              onChange={(event) =>
                setDocumentStatus(
                  event.target.value as "All" | Invoice["documentStatus"],
                )
              }
            >
              <option value="All">All document statuses</option>
              <option>Draft</option>
              <option>Finalized</option>
              <option>Void</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label className="compact-select">
            <span className="sr-only">Invoice payment status</span>
            <select
              value={paymentStatus}
              onChange={(event) =>
                setPaymentStatus(
                  event.target.value as "All" | Invoice["paymentStatus"],
                )
              }
            >
              <option value="All">All payment statuses</option>
              <option>Unpaid</option>
              <option>Part paid</option>
              <option>Paid</option>
              <option>Void</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        </div>
      </section>
      <section className="record-list">
        {visible.map((record) => (
          <InvoiceRow
            key={record.id}
            record={record}
            onView={onView}
            onPaymentStatusChange={onPaymentStatusChange}
            onFinalize={onFinalize}
            onDelete={onDelete}
          />
        ))}
        {!visible.length ? (
          <EmptyState title="No invoices match the current filters." />
        ) : null}
      </section>
    </>
  );
}
