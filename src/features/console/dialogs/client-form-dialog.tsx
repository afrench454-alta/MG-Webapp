"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { Client, Property } from "../domain";
import { Button, Field, IconButton } from "../components/ui-elements";

export function ClientFormDialog({
  client,
  onClose,
  onSave,
  pending = false,
  error = "",
}: {
  client?: Client;
  onClose: () => void;
  onSave: (client: Client) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [name, setName] = useState(client?.name || "");
  const [status, setStatus] = useState(client?.status || "Lead");
  const [phone, setPhone] = useState(client?.phone || "");
  const [email, setEmail] = useState(client?.email || "");
  const [preferred, setPreferred] = useState(client?.preferred || "Email");
  const [notes, setNotes] = useState(client?.notes || "");
  const [properties, setProperties] = useState(
    client?.properties || [{ name: "", address: "", cadence: "One-off" }],
  );

  const updateProperty = (
    index: number,
    key: keyof Property,
    value: string,
  ) =>
    setProperties((current) =>
      current.map((property, itemIndex) =>
        itemIndex === index ? { ...property, [key]: value } : property,
      ),
    );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    void onSave({
      ...(client || {}),
      id: client?.id || `client-${Date.now()}`,
      name,
      status,
      phone,
      email,
      preferred,
      notes,
      properties,
    });
  };

  return (
    <form onSubmit={submit} className="form-stack" aria-busy={pending}>
      <div className="form-grid form-grid--two">
        <Field label="Name" required>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Client["status"])}
          >
            <option>Lead</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Preferred contact" className="field--span-two">
          <select
            value={preferred}
            onChange={(event) =>
              setPreferred(event.target.value as Client["preferred"])
            }
          >
            <option>Email</option>
            <option>Phone</option>
            <option>SMS</option>
          </select>
        </Field>
      </div>
      <section className="nested-section">
        <div className="nested-section__header">
          <h3>Properties / Addresses</h3>
          <Button
            variant="secondary"
            icon={Plus}
            type="button"
            onClick={() =>
              setProperties((current) => [
                ...current,
                { name: "", address: "", cadence: "One-off" },
              ])
            }
          >
            Add property
          </Button>
        </div>
        <div className="property-editor-labels">
          <span>Property name</span>
          <span>Street address</span>
          <span>Cadence</span>
          <span></span>
        </div>
        {properties.map((property, index) => (
          <div
            className="property-editor"
            key={property.id || `new-property-${index}`}
          >
            <input
              aria-label={`Property ${index + 1} name`}
              value={property.name}
              onChange={(event) =>
                updateProperty(index, "name", event.target.value)
              }
              placeholder="Property name"
            />
            <input
              aria-label={`Property ${index + 1} address`}
              value={property.address}
              onChange={(event) =>
                updateProperty(index, "address", event.target.value)
              }
              placeholder="Street address"
            />
            <select
              aria-label={`Property ${index + 1} cadence`}
              value={property.cadence}
              onChange={(event) =>
                updateProperty(index, "cadence", event.target.value)
              }
            >
              <option value="One-off">One-off</option>
              <option value="Weekly">Weekly</option>
              <option value="Fortnightly">Fortnightly</option>
              <option value="Four-weekly">Four-weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Every Tuesday">Every Tuesday</option>
            </select>
            <IconButton
              label={`Remove property ${index + 1}`}
              icon={Trash2}
              tone="danger"
              type="button"
              onClick={() =>
                setProperties((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            />
          </div>
        ))}
      </section>
      <Field label="Notes">
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button icon={Save} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Client"}
        </Button>
      </div>
    </form>
  );
}
