"use client";

import { useRef, useState, type FormEvent } from "react";
import { money, type Invoice, type InvoicePaymentMethod } from "../domain";
import { invoicePaymentSchema, type InvoicePaymentInput } from "../data/invoice-contract";
import { availableInvoiceReceipts, brisbaneToday, canRecordPayment, invoiceAmounts } from "../data/invoice-lifecycle";
import { Button, Field } from "../components/ui-elements";

export const paymentMethodLabels: Record<InvoicePaymentMethod, string> = {
  bank_transfer: "Bank transfer", cash: "Cash", card_external: "Card", cheque: "Cheque", other: "Other",
};

export function InvoicePaymentDialog({ record, pending = false, error = "", onSave, onClose }: {
  record: Invoice;
  pending?: boolean;
  error?: string;
  onSave: (input: InvoicePaymentInput) => void | Promise<void>;
  onClose?: () => void;
}) {
  const canCollect = canRecordPayment(record);
  const receipts = availableInvoiceReceipts(record);
  const [kind, setKind] = useState<InvoicePaymentInput["kind"]>(canCollect ? "receipt" : "refund");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(brisbaneToday);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const previous = useRef<{ fingerprint: string; key: string } | undefined>(undefined);
  const selected = receipts.find((receipt) => receipt.id === receiptId);
  const { amountPaid, balanceDue } = invoiceAmounts(record);
  const maximum = kind === "receipt" ? balanceDue : selected?.available;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !maximum) return;
    const data = {
      invoiceId: record.id, kind, amount: Number(amount), method, paidOn,
      reference: reference.trim() || undefined,
      receiptId: kind === "receipt" ? undefined : receiptId,
      reason: kind === "receipt" ? undefined : reason,
    };
    const fingerprint = JSON.stringify(data);
    if (previous.current?.fingerprint !== fingerprint) previous.current = { fingerprint, key: crypto.randomUUID() };
    const parsed = invoicePaymentSchema.safeParse({ ...data, idempotencyKey: previous.current.key });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? "Check the payment details.");
      return;
    }
    setLocalError("");
    void onSave(parsed.data);
  };

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <p>{record.documentNumber ?? record.id} · {record.client}</p>
      <p>Received {money(amountPaid)} · Balance {money(balanceDue)}</p>
      <Field label="Payment action" required>
        <select value={kind} disabled={pending} onChange={(event) => setKind(event.target.value as InvoicePaymentInput["kind"])}>
          {canCollect ? <option value="receipt">Record receipt</option> : null}
          {receipts.length ? <option value="refund">Record refund</option> : null}
          {receipts.length ? <option value="reversal">Reverse a receipt entry</option> : null}
        </select>
      </Field>
      {kind !== "receipt" ? (
        <Field label="Original receipt" required>
          <select required value={receiptId} disabled={pending} onChange={(event) => setReceiptId(event.target.value)}>
            <option value="">Choose a receipt</option>
            {receipts.map((receipt) => (
              <option key={receipt.id} value={receipt.id}>
                {receipt.paidOn} · {money(receipt.amount)} · {paymentMethodLabels[receipt.method]}
                {receipt.reference ? ` · ${receipt.reference}` : ""} · {money(receipt.available)} available
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="form-grid form-grid--two">
        <Field label="Amount (AUD)" required>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" max={maximum}
            required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending} />
        </Field>
        <Field label={kind === "receipt" ? "Date received" : "Correction date"} required>
          <input type="date" min={selected?.paidOn} max={brisbaneToday()} required value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)} disabled={pending} />
        </Field>
        <Field label="Payment method" required>
          <select required value={method} onChange={(event) => setMethod(event.target.value)} disabled={pending}>
            <option value="">Choose a method</option>
            {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Payment reference">
          <input maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} disabled={pending} />
        </Field>
      </div>
      {kind !== "receipt" ? (
        <Field label="Reason for correction" required>
          <textarea rows={2} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} />
        </Field>
      ) : null}
      {localError || error ? <p className="form-error" role="alert">{localError || error}</p> : null}
      <div className="dialog-actions">
        {onClose ? <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button> : null}
        <Button type="submit" disabled={pending || !maximum}>
          {pending ? "Saving…" : kind === "receipt" ? "Record payment" : kind === "refund" ? "Record refund" : "Record reversal"}
        </Button>
      </div>
    </form>
  );
}
