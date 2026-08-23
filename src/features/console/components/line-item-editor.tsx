"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { money, quoteTotals, type LineItem } from "../domain";
import { Button, IconButton } from "./ui-elements";

export type EditableLineItem = LineItem & {
  id?: string;
};

export function LineItemEditor({
  items,
  setItems,
}: {
  items: LineItem[];
  setItems: Dispatch<SetStateAction<LineItem[]>>;
}) {
  const update = (index: number, key: keyof LineItem, value: string) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { description: "", quantity: 1, rate: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="line-items-section">
      <div className="nested-section__header">
        <h3>
          Line Items <span aria-hidden="true">*</span>
        </h3>
        <Button
          variant="secondary"
          icon={Plus}
          type="button"
          onClick={addItem}
        >
          Add item
        </Button>
      </div>
      <div className="line-item-labels">
        <span>Description</span>
        <span>Qty / hours</span>
        <span>Unit price</span>
        <span>Line total</span>
        <span></span>
      </div>
      {items.map((item, index) => (
        <div className="line-item-row" key={`line-item-${index}`}>
          <input
            aria-label={`Item ${index + 1} description`}
            value={item.description}
            onChange={(event) => update(index, "description", event.target.value)}
            placeholder="Description"
            required
          />
          <input
            aria-label={`Item ${index + 1} quantity`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={item.quantity}
            onChange={(event) => update(index, "quantity", event.target.value)}
            required
          />
          <input
            aria-label={`Item ${index + 1} unit price`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={item.rate}
            onChange={(event) => update(index, "rate", event.target.value)}
            required
          />
          <output aria-label={`Item ${index + 1} total`}>
            {money(Number(item.quantity || 0) * Number(item.rate || 0))}
          </output>
          <IconButton
            label={`Remove line item ${index + 1}`}
            icon={Trash2}
            tone="danger"
            type="button"
            onClick={() => removeItem(index)}
          />
        </div>
      ))}
    </section>
  );
}

export function Totals({ items }: { items: LineItem[] }) {
  const totals = quoteTotals(items);
  return (
    <div className="totals-block">
      <div>
        <span>Subtotal</span>
        <strong>{money(totals.subtotal)}</strong>
      </div>
      <div>
        <span>Tax rate</span>
        <strong>0.00%</strong>
      </div>
      <div className="totals-block__total">
        <span>Total</span>
        <strong>{money(totals.total)}</strong>
      </div>
    </div>
  );
}
