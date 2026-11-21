"use client";

import Image from "next/image";
import { ChevronDown, DollarSign, FileCheck2, Pencil, Printer, Send } from "lucide-react";
import {
  businessProfile as defaultBusinessProfile,
  formatLineQuantity,
  invoiceTerms,
  lineItemSubtotal,
  money,
  quoteTerms,
  quoteTotals,
  type BusinessProfile,
  type Invoice,
  type Quote,
} from "../domain";
import {
  availableInvoiceReceipts, canFinalizeInvoice, canMarkSent, canRecordPayment, canVoidInvoice,
  invoiceAmounts, invoiceDisplayStatus,
} from "../data/invoice-lifecycle";
import { paymentMethodLabels } from "./invoice-payment-dialog";
import { Badge, Button, invoiceDisplayTone, quoteStatusTone } from "../components/ui-elements";

function getDisplayDocumentNumber(record: Quote | Invoice) {
  return record.documentNumber || record.id;
}

function documentDate(value: string) {
  const parsed = new Date(`${value} 00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsed);
}

function plainAmount(value: number) {
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function AccountingAmount({
  value,
  dashForZero = false,
}: {
  value: number;
  dashForZero?: boolean;
}) {
  return (
    <span className="accounting-amount">
      <span>$</span>
      <span>{dashForZero && value === 0 ? "-" : plainAmount(value)}</span>
    </span>
  );
}

export function DocumentViewDialog({
  type,
  record,
  profile = defaultBusinessProfile,
  onClose,
  onStatusChange,
  onFinalize,
  onMarkSent,
  onVoid,
  onCreateInvoice,
  onViewInvoice,
  onEdit,
  onRevise,
  onRecordPayment,
  onReplace,
}: {
  type: "quote" | "invoice";
  record: Quote | Invoice;
  profile?: BusinessProfile;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
  onFinalize?: () => void;
  onMarkSent?: () => void;
  onVoid?: () => void;
  onCreateInvoice?: () => void;
  onViewInvoice?: () => void;
  onEdit?: () => void;
  onRevise?: () => void;
  onRecordPayment?: () => void;
  onReplace?: () => void;
}) {
  const isQuote = "expires" in record;
  if ((type === "quote") !== isQuote) return null;
  const snapshot = isQuote ? undefined : record.snapshot;
  const issuer = (isQuote ? record.issuerSnapshot : snapshot?.issuer) ?? profile;
  const quoteAmounts = isQuote ? quoteTotals(record.items, record.discount ?? 0, record.taxRate ?? 0) : undefined;
  const billing = isQuote ? undefined : invoiceAmounts(record);
  const totals = quoteAmounts ?? billing!;
  const paid = !isQuote && canRecordPayment(record);
  const correctable = !isQuote && availableInvoiceReceipts(record).length > 0;
  const paymentAccount = snapshot?.issuer ?? profile;
  const serviceAddresses = isQuote ? [] : snapshot?.serviceAddresses ?? record.serviceAddresses ?? [record.address].filter(Boolean);
  const documentLabel = isQuote ? "Quote" : "Invoice";
  const scope = isQuote ? [record.scope] : record.scope ?? [];
  const targetRows = isQuote ? 7 : 0;
  const blankRows = Math.max(0, targetRows - record.items.length);

  const printDocument = () => {
    const previousTitle = document.title;
    const filename = `${getDisplayDocumentNumber(record)} - ${record.client}`.replace(
      /[\\/:*?"<>|]+/g,
      "-",
    );

    document.title = filename;
    window.addEventListener("afterprint", () => {
      document.title = previousTitle;
    }, { once: true });
    window.print();
  };

  return (
    <div className="document-view">
      <article
        className={`document-sheet document-sheet--${type}`}
        data-document-kind={type}
        aria-label={`${documentLabel} ${getDisplayDocumentNumber(record)}`}
      >
        <header className="document-letterhead">
          <div className="document-business">
            <h3>{issuer.name}</h3>
            <p>
              <strong>ABN:</strong> {issuer.abn}
            </p>
            <p>{issuer.email}</p>
            <p>{issuer.phone}</p>
            <p>{issuer.website}</p>
          </div>
          <div className="document-heading">
            <Image
              src="/mow-glow-logo.png"
              alt="Mow & Glow Property Services"
              width={172}
              height={172}
              priority
              unoptimized
            />
            <h2>{documentLabel.toUpperCase()}</h2>
          </div>
        </header>

        <section
          className="document-address-row"
          aria-label="Document recipient and details"
        >
          <div className="document-address">
            <h4>ADDRESSED TO</h4>
            {isQuote ? <><strong>{record.client}</strong><span>{record.address}</span></> : (
              <>
                <strong>{snapshot?.billingName ?? record.billingName ?? snapshot?.clientName ?? record.client}</strong>
                {snapshot?.billingAddress || record.billingAddress ? (
                  <span className="document-multiline">{snapshot?.billingAddress ?? record.billingAddress}</span>
                ) : null}
                {snapshot?.recipientName || record.recipientName ? <span>{snapshot?.recipientName ?? record.recipientName}</span> : null}
                {snapshot?.recipientEmail || record.recipientEmail ? <span>{snapshot?.recipientEmail ?? record.recipientEmail}</span> : null}
              </>
            )}
          </div>
          <dl className="document-facts">
            <div>
              <dt>{documentLabel} No.</dt>
              <dd>{getDisplayDocumentNumber(record)}</dd>
            </div>
            <div>
              <dt>{documentLabel} Date</dt>
              <dd>{documentDate(record.issueDate ?? record.issued)}</dd>
            </div>
            <div>
              <dt>{isQuote ? "Valid Until" : "Due"}</dt>
              <dd>
                {isQuote
                  ? record.validUntil === null ? "No expiry" : documentDate(record.expires)
                  : documentDate(record.dueDate ?? record.due)}
              </dd>
            </div>
            {record.reference ? <div><dt>Reference</dt><dd>{record.reference}</dd></div> : null}
            {!isQuote && record.serviceDate ? <div><dt>Service date</dt><dd>{documentDate(record.serviceDate)}</dd></div> : null}
            <div>
              <dt>Status</dt>
              <dd style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {isQuote ? (
                  <Badge tone={quoteStatusTone((record as Quote).status)}>
                    {(record as Quote).status}
                  </Badge>
                ) : (
                  <Badge tone={invoiceDisplayTone(invoiceDisplayStatus(record as Invoice))}>
                    {invoiceDisplayStatus(record as Invoice)}
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className={`document-scope-row${isQuote ? "" : " document-scope-row--invoice"}`}>
          <div className="document-scope">
            {serviceAddresses.length ? <div className="document-sites">
              <h4>Service {serviceAddresses.length === 1 ? "site" : "sites"}</h4>
              {serviceAddresses.map((site, index) => <p key={`${site}-${index}`}>{site}</p>)}
            </div> : null}
            {scope.length ? <h4>SCOPE OF WORK</h4> : null}
            {scope.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            {isQuote && record.clientNotes ? <p className="document-recommendation">{record.clientNotes}</p> : null}
          </div>
          {!isQuote && (record.paymentInstructions || paymentAccount.paymentTo || paymentAccount.bsb || paymentAccount.accountNumber) ? (
            <div className="document-payment">
              <h4>PAYMENT DETAILS</h4>
              {record.paymentInstructions ? <p className="document-multiline">{record.paymentInstructions}</p> : (
                <dl>
                  {paymentAccount.paymentTo ? <div><dt>Account name</dt><dd>{paymentAccount.paymentTo}</dd></div> : null}
                  {paymentAccount.bsb ? <div><dt>BSB</dt><dd>{paymentAccount.bsb}</dd></div> : null}
                  {paymentAccount.accountNumber ? <div><dt>Account number</dt><dd>{paymentAccount.accountNumber}</dd></div> : null}
                </dl>
              )}
            </div>
          ) : null}
        </section>

        <table className="document-table">
          <caption className="sr-only">{documentLabel} line items</caption>
          <colgroup>
            <col />
            <col className="document-table__quantity" />
            <col className="document-table__price" />
            <col className="document-table__total" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Qty</th>
              <th scope="col">Price</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item, index) => (
              <tr key={`${item.description}-${index}`}>
                <td>{item.label ? <strong>{item.label}<br /></strong> : null}{item.description}</td>
                <td>{formatLineQuantity(item)}</td>
                <td>
                  <AccountingAmount value={Number(item.rate)} />
                </td>
                <td>
                  <AccountingAmount
                    value={lineItemSubtotal(item)}
                  />
                </td>
              </tr>
            ))}
            {Array.from({ length: blankRows }, (_, index) => (
              <tr
                className="document-table__blank"
                key={`blank-${index}`}
                aria-hidden="true"
              >
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td>
                  <AccountingAmount value={0} dashForZero />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="document-summary" aria-label="Document totals">
          <p className="document-thanks">
            {isQuote
              ? "Thank you for the opportunity to quote."
              : "Thank you for your business!"}
          </p>
          <dl className="document-totals">
            <div>
              <dt>SUBTOTAL</dt>
              <dd>
                <AccountingAmount value={totals.subtotal} />
              </dd>
            </div>
            {quoteAmounts ? <>
              <div><dt>DISCOUNT</dt><dd><AccountingAmount value={quoteAmounts.discount} dashForZero /></dd></div>
              <div><dt>TAX RATE</dt><dd>{(quoteAmounts.taxRate * 100).toFixed(2)}%</dd></div>
            </> : billing?.tax ? <div><dt>Tax</dt><dd><AccountingAmount value={billing.tax} /></dd></div> : null}
            <div className="document-totals__grand">
              <dt>{documentLabel} Total</dt>
              <dd>
                <AccountingAmount value={totals.total} />
              </dd>
            </div>
          </dl>
        </section>

        <footer className="document-note">
          <h4>{isQuote ? "Notes & Terms" : "Payment terms"}</h4>
          {!isQuote && record.notes ? <p className="document-multiline">{record.notes}</p> : null}
          <p className="document-multiline">{isQuote ? record.terms ?? quoteTerms : record.terms ?? invoiceTerms}</p>
        </footer>
      </article>

      {!isQuote && record.documentStatus !== "Draft" ? (
        <section className="invoice-payment-history" aria-label="Payment summary" data-print-exclude>
          <h3>Payments</h3>
          <p>Received {money(billing!.amountPaid)} · Balance {money(billing!.balanceDue)}</p>
          {!record.snapshot ? <p>Legacy invoice. Customer and business details use the current records where an original snapshot is unavailable.</p> : null}
          {record.duplicateSource ? <p>This invoice shares work with another historical invoice.</p> : null}
          {record.replacesInvoiceId ? <p>Replacement for invoice {record.replacesInvoiceId}. {record.correctionReason}</p> : null}
          {record.payments?.length ? <ul>
            {record.payments.map((entry) => <li key={entry.id}>
              {documentDate(entry.paidOn)} · {entry.status === "voided" ? "Voided receipt" : entry.kind === "receipt" ? "Receipt" : entry.kind === "reversal" ? "Reversal" : "Refund"}
              {" · "}{money(entry.amount)} · {paymentMethodLabels[entry.method]}{entry.reference ? ` · ${entry.reference}` : ""}
              {entry.reason ? <div>{entry.reason}</div> : null}
            </li>)}
          </ul> : null}
        </section>
      ) : null}
      <div className="document-actions" data-print-exclude>
        {isQuote && onStatusChange ? (
        <label className="compact-select">
          <span className="sr-only">Quote status</span>
          <select
            value={record.status}
            onChange={(event) => onStatusChange?.(event.target.value)}
          >
            {quoteStatusOptions(record.status).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        ) : null}
        <div>
          {onEdit ? (
            <Button variant="secondary" icon={Pencil} onClick={onEdit}>
              Edit draft
            </Button>
          ) : null}
          {isQuote && onRevise ? (
            <Button variant="secondary" icon={Pencil} onClick={onRevise}>
              Create revision
            </Button>
          ) : null}
          <Button variant="secondary" icon={Printer} onClick={printDocument}>
            Save / Print PDF
          </Button>
          {isQuote && onViewInvoice ? (
            <Button variant="secondary" icon={DollarSign} onClick={onViewInvoice}>
              View invoice
            </Button>
          ) : null}
          {isQuote && onCreateInvoice ? (
            <Button icon={DollarSign} onClick={onCreateInvoice}>
              Create invoice
            </Button>
          ) : null}
          {(paid || correctable) && onRecordPayment ? (
            <Button onClick={onRecordPayment}>{paid ? "Record payment" : "Correct payment"}</Button>
          ) : null}
          {!isQuote && onReplace && canVoidInvoice(record) ? (
            <Button variant="secondary" onClick={onReplace}>Create replacement</Button>
          ) : null}
          {!isQuote && canFinalizeInvoice(record as Invoice) ? (
            <Button variant="secondary" icon={FileCheck2} onClick={onFinalize}>
              Issue
            </Button>
          ) : null}
          {!isQuote && canMarkSent(record as Invoice) ? (
            <Button variant="secondary" icon={Send} onClick={onMarkSent}>
              Mark sent
            </Button>
          ) : null}
          {!isQuote && canVoidInvoice(record as Invoice) ? (
            <Button variant="secondary" onClick={onVoid}>
              Void
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function quoteStatusOptions(status: Quote["status"]): Quote["status"][] {
  if (status === "Draft") return [status, "Sent", "Accepted", "Void"];
  if (status === "Sent") return [status, "Accepted", "Declined", "Expired", "Void"];
  return status === "Void" ? [status] : [status, "Void"];
}
