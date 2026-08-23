"use client";

import { useState } from "react";
import { ChevronDown, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import type { Client } from "../domain";
import { Badge, Button, EmptyState, IconButton, matchesText, PageHeader } from "../components/ui-elements";

export function ClientsView({
  clients,
  onEdit,
  onCreate,
  onDelete,
  canManage,
  archiveMode,
}: {
  clients: Client[];
  onEdit: (client: Client) => void;
  onCreate: () => void;
  onDelete: (client: Client) => void;
  canManage: boolean;
  archiveMode: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Client["status"]>("All");
  const [preferred, setPreferred] = useState<"All" | Client["preferred"]>("All");

  const visible = clients.filter((client) => {
    const searchable = [
      client.name,
      client.phone,
      client.email,
      client.notes,
      ...client.properties.flatMap((property) => [
        property.name,
        property.address,
        property.cadence,
      ]),
    ].join(" ");
    return (
      matchesText(searchable, query) &&
      (status === "All" || client.status === status) &&
      (preferred === "All" || client.preferred === preferred)
    );
  });

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="Clients"
        subtitle="Each client can have multiple properties."
      >
        {canManage ? (
          <Button icon={Plus} onClick={onCreate}>
            New Client
          </Button>
        ) : null}
      </PageHeader>
      <section className="list-filters" aria-label="Client filters">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search clients</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
          />
        </label>
        <div className="filter-controls">
          <span className="filter-controls__label">Filter by</span>
          <label className="compact-select">
            <span className="sr-only">Client status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | Client["status"])
              }
            >
              <option value="All">All statuses</option>
              <option>Lead</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label className="compact-select">
            <span className="sr-only">Preferred contact</span>
            <select
              value={preferred}
              onChange={(event) =>
                setPreferred(event.target.value as "All" | Client["preferred"])
              }
            >
              <option value="All">All contact methods</option>
              <option>Email</option>
              <option>Phone</option>
              <option>SMS</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
        </div>
      </section>
      {visible.length ? (
        <section className="client-grid">
          {visible.map((client) => (
            <article className="client-card" key={client.id}>
              <div className="card-heading">
                <div className="title-with-badge">
                  <h2>{client.name}</h2>
                  <Badge>{client.status}</Badge>
                </div>
                {canManage ? (
                  <div className="inline-actions">
                    <IconButton
                      label={`Edit ${client.name}`}
                      icon={Pencil}
                      onClick={() => onEdit(client)}
                    />
                    <IconButton
                      label={`${archiveMode ? "Archive" : "Delete"} ${client.name}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => onDelete(client)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="contact-row">
                <span>
                  <Phone aria-hidden="true" size={16} /> {client.phone}
                </span>
                <span>
                  <Mail aria-hidden="true" size={16} /> {client.email}
                </span>
              </div>
              <div className="property-list">
                {client.properties.map((property) => (
                  <div
                    key={
                      property.id || `${property.name}-${property.address}`
                    }
                  >
                    <MapPin aria-hidden="true" size={16} />
                    <strong>{property.name}</strong>
                    <span>· {property.address}</span>
                  </div>
                ))}
              </div>
              {client.notes ? (
                <p className="client-note">{client.notes}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No clients match the current filters." />
      )}
    </>
  );
}
