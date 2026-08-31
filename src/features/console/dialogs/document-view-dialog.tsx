"use client";

import Image from "next/image";
import { ChevronDown, FileCheck2, Printer } from "lucide-react";
import {
  businessProfile,
  invoiceTerms,
  quoteTerms,
  quoteTotals,
  type Invoice,
  type Quote,
} from "../domain";
import { allowedPaymentStatuses, canFinalizeInvoice, canMarkPaid, canVoidInvoice, invoiceDisplayStatus } from "../data/invoice-lifecycle";
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
  onClose,
  onStatusChange,
  onFinalize,
  onVoid,
}: {
  type: "quote" | "invoice";
  record: Quote | Invoice;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
  onFinalize?: () => void;
  onVoid?: () => void;
}) {
  const isQuote = "expires" in record;
  if ((type === "quote") !== isQuote) return null;
  const totals = quoteTotals(
    record.items,
    record.discount ?? 0,
    record.taxRate ?? 0,
  );
  const documentLabel = isQuote ? "Quote" : "Invoice";
  const status = isQuote ? record.status : record.paymentStatus;
  const scope = isQuote
    ? [record.scope]
    : record.scope?.length
      ? record.scope
      : record.items.map((item) => item.description);
  const targetRows = isQuote ? 7 : 6;
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
            <h3>{businessProfile.name}</h3>
            <p>
              <strong>ABN:</strong> {businessProfile.abn}
            </p>
            <p>{businessProfile.email}</p>
            <p>{businessProfile.phone}</p>
            <p>{businessProfile.website}</p>
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
            <strong>{record.client}</strong>
            <span>{record.address}</span>
          </div>
          <dl className="document-facts">
            <div>
              <dt>{documentLabel} No.</dt>
              <dd>{getDisplayDocumentNumber(record)}</dd>
            </div>
            <div>
              <dt>{documentLabel} Date</dt>
              <dd>{documentDate(record.issued)}</dd>
            </div>
            <div>
              <dt>{isQuote ? "Valid For" : "Due"}</dt>
              <dd>
                {isQuote
                  ? `${record.validDays} Days`
                  : record.due === "Upon completion"
                    ? record.due
                    : documentDate(record.due)}
              </dd>
            </div>
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

        <section
          className={`document-scope-row${isQuote ? "" : " document-scope-row--invoice"}`}
        >
          <div className="document-scope">
            <h4>SCOPE OF WORK</h4>
            {scope.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
            {isQuote && record.clientNotes ? (
              <p className="document-recommendation">
                <strong>Recommendation:</strong> {record.clientNotes}
              </p>
            ) : null}
          </div>
          {!isQuote ? (
            <div className="document-payment">
              <h4>PAYMENT DETAILS</h4>
              <dl>
                <div>
                  <dt>To:</dt>
                  <dd>{businessProfile.paymentTo}</dd>
                </div>
                <div>
                  <dt>BSB:</dt>
                  <dd>{businessProfile.bsb}</dd>
                </div>
                <div>
                  <dt>ACC:</dt>
                  <dd>{businessProfile.accountNumber}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </section>

        <table className="document-table">
          <caption className="sr-only">{documentLabel} line items</caption>
          <colgroup>
            <col />
            <col className="document-table__quantity" />
            <col className="document-table__hours" />
            <col className="document-table__unit" />
            <col className="document-table__price" />
            <col className="document-table__total" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Qty</th>
              <th scope="col">Hour&apos;s</th>
              <th scope="col">Unit</th>
              <th scope="col">Price</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((item, index) => (
              <tr key={`${item.description}-${index}`}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td></td>
                <td>Each</td>
                <td>
                  <AccountingAmount value={Number(item.rate)} />
                </td>
                <td>
                  <AccountingAmount
                    value={Number(item.quantity) * Number(item.rate)}
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
            <div>
              <dt>DISCOUNT</dt>
              <dd>
                <AccountingAmount value={totals.discount} dashForZero />
              </dd>
            </div>
            <div>
              <dt>TAX RATE</dt>
              <dd>{(totals.taxRate * 100).toFixed(2)}%</dd>
            </div>
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
          {!isQuote && record.notes ? <p>{record.notes}</p> : null}
          <p>{isQuote ? quoteTerms : invoiceTerms}</p>
        </footer>
      </article>

      <div className="document-actions" data-print-exclude>
        {isQuote || allowedPaymentStatuses(record as Invoice).length ? (
        <label className="compact-select">
          <span className="sr-only">
            {isQuote ? "Quote status" : "Payment status"}
          </span>
          <select
            value={status}
            onChange={(event) => onStatusChange?.(event.target.value)}
          >
            {(isQuote
              ? ["Draft", "Sent", "Accepted", "Declined", "Expired", "Void"]
              : allowedPaymentStatuses(record as Invoice)
            ).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        ) : null}
        <div>
          <Button variant="secondary" icon={Printer} onClick={printDocument}>
            Save / Print PDF
          </Button>
          {!isQuote && canMarkPaid(record as Invoice) ? (
            <Button
              onClick={() => onStatusChange?.("Paid")}
            >
              Mark paid
            </Button>
          ) : null}
          {!isQuote && canFinalizeInvoice(record as Invoice) ? (
            <Button variant="secondary" icon={FileCheck2} onClick={onFinalize}>
              Issue
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
