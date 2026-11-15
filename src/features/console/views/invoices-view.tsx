"use client";

import { useState, useMemo, memo } from "react";
import { Ban, DollarSign, Eye, Pencil, Plus, Search, Send, Trash2, FileCheck2 } from "lucide-react";
import { money, type Invoice } from "../domain";
import {
  availableInvoiceReceipts,
  canDeleteInvoice,
  canFinalizeInvoice,
  canRecordPayment,
  canMarkSent,
  canVoidInvoice,
  invoiceAmounts,
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
import { formatSiteTitle } from "../data/work-identity";

const InvoiceRow = memo(function InvoiceRow({
  record,
  pending,
  onView,
  onEdit,
  onRecordPayment,
  onMarkSent,
  onVoid,
  onDelete,
}: {
  record: Invoice;
  pending: boolean;
  onView: (record: Invoice) => void;
  onEdit: (record: Invoice) => void;
  onRecordPayment: (record: Invoice) => void;
  onMarkSent: (record: Invoice) => void;
  onVoid: (record: Invoice) => void;
  onDelete: (record: Invoice) => void;
}) {
  const { total, amountPaid, balanceDue } = invoiceAmounts(record);
  const display = invoiceDisplayStatus(record);
  const canCollect = canRecordPayment(record);
  const canCorrect = availableInvoiceReceipts(record).length > 0;

  return (
    <article className="record-row">
      <div>
        <div className="title-with-badge">
          <h2>{record.documentNumber || record.id}</h2>
          <Badge tone={invoiceDisplayTone(display)}>{display}</Badge>
        </div>
        <strong className="record-client">{formatSiteTitle(record)}</strong>
        <p>{record.documentStatus === "Draft" ? "Issue date" : "Issued"} {record.issued} · Due {record.due}</p>
        {record.duplicateSource ? <p>Shared work link · Review historical invoices</p> : null}
      </div>
      <div className="record-row__actions">
        <div className="amount-block">
          <strong>{money(total)}</strong>
          {record.documentStatus !== "Draft" && record.documentStatus !== "Void" ? (
            <small>Received {money(amountPaid)} · Balance {money(balanceDue)}</small>
          ) : null}
        </div>
        <Button variant="secondary" icon={Eye} onClick={() => onView(record)} disabled={pending}>
          View
        </Button>
        {canFinalizeInvoice(record) ? (
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => onEdit(record)}
            disabled={pending}
          >
            Edit
          </Button>
        ) : null}
        {canCollect || canCorrect ? (
          <Button icon={DollarSign} onClick={() => onRecordPayment(record)} disabled={pending}>
            {canCollect ? "Record payment" : "Correct payment"}
          </Button>
        ) : null}
        {canFinalizeInvoice(record) ? (
          <Button variant="secondary" icon={FileCheck2} onClick={() => onView(record)} disabled={pending}>
            Review draft
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
  onEdit,
  onRecordPayment,
  onMarkSent,
  onVoid,
  onDelete,
}: {
  records: Invoice[];
  pending?: boolean;
  onNew: () => void;
  onView: (record: Invoice) => void;
  onEdit: (record: Invoice) => void;
  onRecordPayment: (record: Invoice) => void;
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
      .filter((record) => record.documentStatus !== "Draft" && record.documentStatus !== "Void")
      .reduce((sum, record) => sum + invoiceAmounts(record).balanceDue, 0);
  }, [records]);

  const paid = useMemo(() => {
    return records
      .reduce((sum, record) => sum + invoiceAmounts(record).amountPaid, 0);
  }, [records]);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        subtitle="Create drafts, issue invoices and record payments received."
      >
        <div className="billing-summary">
          <span>
            Outstanding: <strong>{money(outstanding)}</strong>
          </span>
          <span>
            Received: <strong className="success-text">{money(paid)}</strong>
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
            onEdit={onEdit}
            onRecordPayment={onRecordPayment}
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
