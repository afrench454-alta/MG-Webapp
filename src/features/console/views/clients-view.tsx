"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  money,
  quoteTotals,
  type Client,
  type Invoice,
  type Job,
  type JobRequest,
  type Quote,
} from "../domain";
import {
  clientFilterIds,
  countMatching,
  isLiveInvoice,
  isLiveQuote,
  matchesClientFilter,
  type ClientFilterId,
} from "../data/list-filters";
import { displayServiceCategory } from "../data/service-catalog";
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
  jobs = [],
  jobRequests = [],
  quotes = [],
  invoices = [],
  selectedClientId: controlledSelectedId,
  onSelectClient,
  onEdit,
  onCreate,
  onDelete,
  onNewRequestForClient,
  onNewQuoteForClient,
  onOpenJob,
  canManage,
  archiveMode,
}: {
  clients: Client[];
  jobs?: Job[];
  jobRequests?: JobRequest[];
  quotes?: Quote[];
  invoices?: Invoice[];
  selectedClientId?: string;
  onSelectClient?: (clientId: string) => void;
  onEdit: (client: Client) => void;
  onCreate: () => void;
  onDelete: (client: Client) => void;
  onNewRequestForClient?: (client: Client) => void;
  onNewQuoteForClient?: (client: Client) => void;
  onOpenJob?: (job: Job) => void;
  canManage: boolean;
  archiveMode: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClientFilterId>("all");
  const [internalSelectedId, setInternalSelectedId] = useState<string>(
    () => clients[0]?.id || "",
  );
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

  const activeClientId = controlledSelectedId ?? internalSelectedId;
  const inspectedClient =
    visible.find((client) => client.id === activeClientId) ||
    clients.find((client) => client.id === activeClientId) ||
    visible[0] ||
    clients[0];

  const selectClient = (client: Client) => {
    setInternalSelectedId(client.id);
    onSelectClient?.(client.id);
  };

  const totalProperties = useMemo(
    () => clients.reduce((sum, client) => sum + client.properties.length, 0),
    [clients],
  );
  const recurringProperties = useMemo(
    () =>
      clients.reduce(
        (sum, client) =>
          sum +
          client.properties.filter(
            (prop) => prop.cadence && prop.cadence !== "One-off",
          ).length,
        0,
      ),
    [clients],
  );

  const clientJobs = inspectedClient
    ? jobs.filter(
        (job) =>
          job.clientId === inspectedClient.id ||
          job.client.toLowerCase() === inspectedClient.name.toLowerCase(),
      )
    : [];

  const clientRequests = inspectedClient
    ? jobRequests.filter(
        (req) =>
          req.clientId === inspectedClient.id ||
          req.client.toLowerCase() === inspectedClient.name.toLowerCase(),
      )
    : [];

  const clientQuotes = inspectedClient
    ? quotes
        .filter(isLiveQuote)
        .filter(
          (quote) =>
            quote.clientId === inspectedClient.id ||
            quote.client.toLowerCase() ===
              inspectedClient.name.toLowerCase(),
        )
    : [];

  const clientInvoices = inspectedClient
    ? invoices
        .filter(isLiveInvoice)
        .filter(
          (inv) =>
            inv.clientId === inspectedClient.id ||
            inv.client.toLowerCase() === inspectedClient.name.toLowerCase(),
        )
    : [];

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

      <section
        className="client-portfolio-strip"
        aria-label="Client portfolio summary"
      >
        <div className="client-portfolio-tile">
          <span className="client-portfolio-tile__icon">
            <Users aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="eyebrow">Total Clients</p>
            <strong>{clients.length}</strong>
            <small>{counts.active} active accounts</small>
          </div>
        </div>
        <div className="client-portfolio-tile">
          <span className="client-portfolio-tile__icon">
            <Building2 aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="eyebrow">Managed Properties</p>
            <strong>{totalProperties}</strong>
            <small>Residential & acreage sites</small>
          </div>
        </div>
        <div className="client-portfolio-tile">
          <span className="client-portfolio-tile__icon">
            <Repeat aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="eyebrow">Recurring Cadence</p>
            <strong>{recurringProperties}</strong>
            <small>Weekly, fortnightly & monthly</small>
          </div>
        </div>
        <div className="client-portfolio-tile">
          <span className="client-portfolio-tile__icon">
            <Sparkles aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="eyebrow">Active Leads</p>
            <strong>{counts.leads}</strong>
            <small>Prospective property quotes</small>
          </div>
        </div>
      </section>

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
        <div className="clients-hub-layout">
          <section className="client-grid">
            {visible.map((client) => {
              const isSelected = inspectedClient?.id === client.id;
              return (
                <article
                  className={`client-card ${isSelected ? "client-card--selected" : ""}`}
                  key={client.id}
                  onClick={() => selectClient(client)}
                >
                  <div className="card-heading">
                    <div className="title-with-badge">
                      <h2>{client.name}</h2>
                      <Badge
                        tone={
                          client.status === "Active"
                            ? "forest"
                            : client.status === "Lead"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {client.status}
                      </Badge>
                    </div>
                    {canManage ? (
                      <div
                        className="inline-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
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
                        {property.cadence ? (
                          <small className="property-cadence-pill">
                            {property.cadence}
                          </small>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {client.notes ? (
                    <p className="client-note">{client.notes}</p>
                  ) : null}
                </article>
              );
            })}
          </section>

          {inspectedClient ? (
            <aside
              className="client-inspector"
              aria-label="Property intelligence inspector"
            >
              <div className="client-inspector__header">
                <div>
                  <p className="eyebrow">Property Intelligence Inspector</p>
                  <h3>{inspectedClient.name}</h3>
                  <small>
                    Preferred contact: {inspectedClient.preferred} ·{" "}
                    {inspectedClient.properties.length}{" "}
                    {inspectedClient.properties.length === 1
                      ? "property"
                      : "properties"}
                  </small>
                </div>
                <Badge
                  tone={
                    inspectedClient.status === "Active"
                      ? "forest"
                      : inspectedClient.status === "Lead"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {inspectedClient.status}
                </Badge>
              </div>

              <div className="client-inspector__contact">
                <a href={`tel:${inspectedClient.phone.replace(/\s+/g, "")}`}>
                  <Phone aria-hidden="true" size={15} />
                  <span>{inspectedClient.phone}</span>
                </a>
                {inspectedClient.email ? (
                  <a href={`mailto:${inspectedClient.email}`}>
                    <Mail aria-hidden="true" size={15} />
                    <span>{inspectedClient.email}</span>
                  </a>
                ) : null}
              </div>

              <div className="client-inspector__section">
                <p className="eyebrow">Managed Sites & Cadence</p>
                <div className="client-inspector__sites">
                  {inspectedClient.properties.map((property) => (
                    <div
                      className="client-inspector__site-card"
                      key={
                        property.id || `${property.name}-${property.address}`
                      }
                    >
                      <div className="client-inspector__site-top">
                        <strong>{property.name}</strong>
                        <Badge tone="sage">
                          {property.cadence || "One-off"}
                        </Badge>
                      </div>
                      <p>
                        <MapPin aria-hidden="true" size={14} />{" "}
                        {property.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {inspectedClient.notes ? (
                <div className="client-inspector__section">
                  <p className="eyebrow">Site & Access Notes</p>
                  <p className="client-inspector__notes">
                    {inspectedClient.notes}
                  </p>
                </div>
              ) : null}

              <div className="client-inspector__section">
                <p className="eyebrow">Operational History</p>
                <div className="client-inspector__stats">
                  <div>
                    <strong>{clientJobs.length}</strong>
                    <small>Jobs</small>
                  </div>
                  <div>
                    <strong>{clientRequests.length}</strong>
                    <small>Requests</small>
                  </div>
                  <div>
                    <strong>{clientQuotes.length}</strong>
                    <small>Quotes</small>
                  </div>
                  <div>
                    <strong>
                      {money(
                        clientInvoices.reduce(
                          (sum, inv) =>
                            sum +
                            quoteTotals(
                              inv.items,
                              inv.discount ?? 0,
                              inv.taxRate ?? 0,
                            ).total,
                          0,
                        ),
                      )}
                    </strong>
                    <small>Billed</small>
                  </div>
                </div>

                {clientJobs.length ? (
                  <div className="client-inspector__recent-jobs">
                    {clientJobs.slice(0, 2).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        className="client-inspector__job-row"
                        onClick={() => onOpenJob?.(job)}
                      >
                        <div>
                          <strong>
                            {displayServiceCategory(job.category)}
                          </strong>
                          <small>
                            {job.date}
                            {job.time ? ` · ${job.time}` : ""}
                          </small>
                        </div>
                        <Badge tone="neutral">
                          {job.status.replace("-", " ")}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {canManage ? (
                <div className="client-inspector__actions">
                  {onNewRequestForClient ? (
                    <Button
                      variant="secondary"
                      icon={ClipboardList}
                      onClick={() => onNewRequestForClient(inspectedClient)}
                    >
                      New Request
                    </Button>
                  ) : null}
                  {onNewQuoteForClient ? (
                    <Button
                      variant="secondary"
                      icon={ReceiptText}
                      onClick={() => onNewQuoteForClient(inspectedClient)}
                    >
                      New Quote
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : (
        <EmptyState title="No clients match the current filters." />
      )}
    </>
  );
}
