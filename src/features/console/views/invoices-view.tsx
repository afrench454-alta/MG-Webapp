"use client";

import { useState, useMemo, memo } from "react";
import type { ChangeEvent } from "react";
import { Ban, Check, ChevronDown, Eye, Plus, Search, Trash2, FileCheck2 } from "lucide-react";
import { money, quoteTotals, type Invoice } from "../domain";
import {
  allowedPaymentStatuses,
  canDeleteInvoice,
  canFinalizeInvoice,
  canMarkPaid,
  canVoidInvoice,
  invoiceDisplayStatus,
  type InvoiceDisplayStatus,
} from "../data/invoice-lifecycle";
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  matchesText,
  PageHeader,
  invoiceDisplayTone,
} from "../components/ui-elements";

const InvoiceRow = memo(function InvoiceRow({
  record,
  onView,
  onPaymentStatusChange,
  onFinalize,
  onVoid,
  onDelete,
}: {
  record: Invoice;
  onView: (record: Invoice) => void;
  onPaymentStatusChange: (id: string, status: Invoice["paymentStatus"]) => void;
  onFinalize: (record: Invoice) => void;
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
            >
              {paymentOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        ) : (
          <span className="record-payment-locked">{record.paymentStatus}</span>
        )}
        <Button variant="secondary" icon={Eye} onClick={() => onView(record)}>
          View
        </Button>
        {canMarkPaid(record) ? (
          <Button
            variant="primary"
            icon={Check}
            onClick={() => onPaymentStatusChange(record.id, "Paid")}
          >
            Mark paid
          </Button>
        ) : null}
        {canFinalizeInvoice(record) ? (
          <Button variant="secondary" icon={FileCheck2} onClick={() => onFinalize(record)}>
            Issue
          </Button>
        ) : null}
        {canVoidInvoice(record) ? (
          <Button variant="secondary" icon={Ban} onClick={() => onVoid(record)}>
            Void
          </Button>
        ) : null}
        {canDeleteInvoice(record) ? (
          <IconButton
            label={`Delete ${record.documentNumber || record.id}`}
            icon={Trash2}
            tone="danger"
            onClick={() => onDelete(record)}
          />
        ) : null}
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
  onVoid,
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
  onVoid: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | InvoiceDisplayStatus>("All");

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
      const display = invoiceDisplayStatus(record);
      return (
        matchesText(searchable, query) && (status === "All" || display === status)
      );
    });
  }, [records, query, status]);

  const outstanding = useMemo(() => {
    return records
      .filter((record) =>
        ["Draft", "Issued", "Sent", "Overdue", "Part paid"].includes(
          invoiceDisplayStatus(record),
        ),
      )
      .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  }, [records]);

  const paid = useMemo(() => {
    return records
      .filter((record) => invoiceDisplayStatus(record) === "Paid")
      .reduce((sum, record) => sum + quoteTotals(record.items).total, 0);
  }, [records]);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        subtitle="Mark paid issues a draft in one step. Void unpaid issued invoices. Delete drafts only."
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
            <span className="sr-only">Invoice status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | InvoiceDisplayStatus)
              }
            >
              <option value="All">All statuses</option>
              <option>Draft</option>
              <option>Issued</option>
              <option>Sent</option>
              <option>Overdue</option>
              <option>Part paid</option>
              <option>Paid</option>
              <option>Refunded</option>
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
            onVoid={onVoid}
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
