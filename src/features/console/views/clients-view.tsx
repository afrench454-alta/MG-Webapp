"use client";

import { useMemo, useState } from "react";
import { Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import type { Client } from "../domain";
import {
  clientFilterIds,
  countMatching,
  matchesClientFilter,
  type ClientFilterId,
} from "../data/list-filters";
import {
  Badge,
  Button,
  EmptyState,
  FilterGroup,
  IconButton,
  matchesText,
  PageHeader,
} from "../components/ui-elements";

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
  const [filter, setFilter] = useState<ClientFilterId>("all");
  const counts = useMemo(
    () => countMatching(clients, clientFilterIds, matchesClientFilter),
    [clients],
  );

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
    return matchesText(searchable, query) && matchesClientFilter(client, filter);
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
          <FilterGroup
            label="Client view"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "active", label: "Active", count: counts.active },
              { id: "leads", label: "Leads", count: counts.leads },
              { id: "inactive", label: "Inactive", count: counts.inactive },
            ]}
          />
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
                {client.email ? (
                  <span>
                    <Mail aria-hidden="true" size={16} /> {client.email}
                  </span>
                ) : null}
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
