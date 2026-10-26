"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarPlus,
  ClipboardList,
  DollarSign,
  Menu,
  MessageCircle,
  Plus,
  ReceiptText,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { productBrand } from "@/lib/brand";
import {
  money,
  quoteTotals,
  type BusinessProfile,
  type Client,
  type ConsoleRoute,
  type Invoice,
  type Job,
  type JobRequest,
  type Quote,
} from "../domain";
import { isLiveInvoice, isLiveQuote } from "../data/list-filters";
import { displayServiceCategory } from "../data/service-catalog";
import { formatSiteTitle } from "../data/work-identity";
import { Badge } from "./ui-elements";

type SearchHit = {
  id: string;
  group: "Clients" | "Jobs" | "Requests" | "Quotes" | "Invoices";
  title: string;
  subtitle: string;
  badge?: string;
  onSelect: () => void;
};

export function TopCommandBar({
  businessDetails,
  clients,
  jobs,
  jobRequests,
  quotes,
  invoices,
  alertCount,
  alertsOpen,
  canManage,
  onOpenMobileNav,
  onToggleAlerts,
  onNavigate,
  onSelectClient,
  onSelectJob,
  onSelectQuote,
  onSelectInvoice,
  onNewClient,
  onNewRequest,
  onNewQuote,
  onNewInvoice,
  onScheduleJob,
}: {
  businessDetails: BusinessProfile;
  clients: Client[];
  jobs: Job[];
  jobRequests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  alertCount: number;
  alertsOpen: boolean;
  canManage: boolean;
  onOpenMobileNav: () => void;
  onToggleAlerts: () => void;
  onNavigate: (route: ConsoleRoute) => void;
  onSelectClient: (client: Client) => void;
  onSelectJob: (job: Job) => void;
  onSelectQuote: (quote: Quote) => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onNewClient: () => void;
  onNewRequest: () => void;
  onNewQuote: () => void;
  onNewInvoice: () => void;
  onScheduleJob: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setQuickCreateOpen(false);
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (quickMenuRef.current && !quickMenuRef.current.contains(target)) {
        setQuickCreateOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const inProgressCount = useMemo(
    () => jobs.filter((job) => job.status === "in-progress").length,
    [jobs],
  );
  const scheduledCount = useMemo(
    () => jobs.filter((job) => job.status === "scheduled").length,
    [jobs],
  );

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const hits: SearchHit[] = [];

    const match = (text: string) =>
      !q || text.toLowerCase().includes(q);

    if (canManage) {
      for (const client of clients) {
        const hay = `${client.name} ${client.phone} ${client.email} ${client.properties
          .map((p) => `${p.name} ${p.address}`)
          .join(" ")}`;
        if (match(hay)) {
          hits.push({
            id: `client-${client.id}`,
            group: "Clients",
            title: client.name,
            subtitle:
              client.properties[0]?.address || client.email || client.phone,
            badge: client.status,
            onSelect: () => {
              onSelectClient(client);
              setSearchOpen(false);
              setQuery("");
            },
          });
        }
      }
    }

    for (const job of jobs) {
      const hay = `${job.displayName} ${job.client} ${job.address} ${job.category} ${job.assignees.join(" ")}`;
      if (match(hay)) {
        hits.push({
          id: `job-${job.id}`,
          group: "Jobs",
          title: formatSiteTitle(job),
          subtitle: `${job.date}${job.time ? ` · ${job.time}` : ""} · ${displayServiceCategory(job.category)}`,
          badge: job.status.replace("-", " "),
          onSelect: () => {
            onSelectJob(job);
            setSearchOpen(false);
            setQuery("");
          },
        });
      }
    }

    for (const request of jobRequests) {
      const hay = `${request.client} ${request.address} ${request.category} ${request.scope}`;
      if (match(hay)) {
        hits.push({
          id: `req-${request.id}`,
          group: "Requests",
          title: formatSiteTitle(request),
          subtitle: `${displayServiceCategory(request.category)} · ${request.scope}`,
          badge: request.status,
          onSelect: () => {
            onNavigate("requests");
            setSearchOpen(false);
            setQuery("");
          },
        });
      }
    }

    if (canManage) {
      for (const quote of quotes.filter(isLiveQuote)) {
        const hay = `${quote.documentNumber || quote.id} ${quote.client} ${quote.address} ${quote.scope}`;
        if (match(hay)) {
          const total = quoteTotals(
            quote.items,
            quote.discount ?? 0,
            quote.taxRate ?? 0,
          ).total;
          hits.push({
            id: `quote-${quote.id}`,
            group: "Quotes",
            title: `${quote.documentNumber || quote.id} · ${quote.client}`,
            subtitle: `${quote.address} · ${money(total)}`,
            badge: quote.status,
            onSelect: () => {
              onSelectQuote(quote);
              setSearchOpen(false);
              setQuery("");
            },
          });
        }
      }

      for (const inv of invoices.filter(isLiveInvoice)) {
        const hay = `${inv.documentNumber || inv.id} ${inv.client} ${inv.address} ${inv.scope}`;
        if (match(hay)) {
          const total = quoteTotals(
            inv.items,
            inv.discount ?? 0,
            inv.taxRate ?? 0,
          ).total;
          hits.push({
            id: `inv-${inv.id}`,
            group: "Invoices",
            title: `${inv.documentNumber || inv.id} · ${inv.client}`,
            subtitle: `${inv.address} · ${money(total)}`,
            badge: inv.paymentStatus,
            onSelect: () => {
              onSelectInvoice(inv);
              setSearchOpen(false);
              setQuery("");
            },
          });
        }
      }
    }

    return hits.slice(0, 8);
  }, [
    canManage,
    clients,
    invoices,
    jobRequests,
    jobs,
    onNavigate,
    onSelectClient,
    onSelectInvoice,
    onSelectJob,
    onSelectQuote,
    query,
    quotes,
  ]);

  return (
    <header className="top-command-bar">
      <div className="top-command-bar__left">
        <button
          type="button"
          className="top-command-bar__menu-btn"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <div className="top-command-bar__identity">
          <small>{productBrand}</small>
          <strong>{businessDetails.name || "Console"}</strong>
        </div>
      </div>

      <div className="top-command-bar__search-wrap" ref={searchWrapRef}>
        <label className="top-command-bar__search">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Global console search</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search clients, properties, jobs, quotes, or invoices..."
          />
          {query ? (
            <button
              type="button"
              className="top-command-bar__search-clear"
              aria-label="Clear global search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden="true" size={14} />
            </button>
          ) : (
            <kbd className="top-command-bar__kbd" aria-hidden="true">
              ⌘K
            </kbd>
          )}
        </label>

        {searchOpen ? (
          <div
            className="top-command-bar__results"
            role="region"
            aria-label="Global search results"
          >
            <div className="top-command-bar__results-header">
              <span>
                {query.trim()
                  ? `Matching records (${searchHits.length})`
                  : "Quick jump across console"}
              </span>
              <small>ESC to close</small>
            </div>
            {searchHits.length ? (
              <ul className="top-command-bar__results-list" role="list">
                {searchHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="top-command-bar__result-item"
                      onClick={hit.onSelect}
                    >
                      <span className="top-command-bar__result-group">
                        {hit.group}
                      </span>
                      <span className="top-command-bar__result-copy">
                        <strong>{hit.title}</strong>
                        <small>{hit.subtitle}</small>
                      </span>
                      {hit.badge ? <Badge>{hit.badge}</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="top-command-bar__results-empty">
                No console records match &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="top-command-bar__actions">
        <button
          type="button"
          className="top-command-bar__status-pill"
          onClick={() => onNavigate("jobs")}
          title="View active field jobs on the Job Board"
        >
          <span className="top-command-bar__status-dot" aria-hidden="true" />
          <span>
            {inProgressCount} active · {scheduledCount} scheduled
          </span>
        </button>

        <button
          type="button"
          className={`top-command-bar__bell ${alertsOpen ? "is-active" : ""}`}
          aria-label="Operational alerts"
          aria-expanded={alertsOpen}
          aria-controls="operational-alerts-drawer"
          onClick={onToggleAlerts}
        >
          <Bell aria-hidden="true" size={18} />
          {alertCount > 0 ? (
            <span className="top-command-bar__bell-badge">{alertCount}</span>
          ) : null}
        </button>

        {canManage ? (
          <div className="top-command-bar__quick-wrap" ref={quickMenuRef}>
            <button
              type="button"
              className="button button--primary top-command-bar__quick-btn"
              aria-expanded={quickCreateOpen}
              onClick={() => setQuickCreateOpen((open) => !open)}
            >
              <Plus aria-hidden="true" size={16} />
              <span>Quick Create</span>
            </button>

            {quickCreateOpen ? (
              <div
                className="top-command-bar__quick-menu"
                role="menu"
                aria-label="Quick create actions"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onScheduleJob();
                  }}
                >
                  <CalendarPlus aria-hidden="true" size={16} />
                  <div>
                    <strong>Schedule Job</strong>
                    <small>Assign crew & dispatch time</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onNewRequest();
                  }}
                >
                  <ClipboardList aria-hidden="true" size={16} />
                  <div>
                    <strong>New Job Request</strong>
                    <small>Log a client property request</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onNewQuote();
                  }}
                >
                  <ReceiptText aria-hidden="true" size={16} />
                  <div>
                    <strong>New Quote</strong>
                    <small>Prepare line-item estimate</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onNewInvoice();
                  }}
                >
                  <DollarSign aria-hidden="true" size={16} />
                  <div>
                    <strong>New Invoice</strong>
                    <small>Bill a completed job or quote</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onNewClient();
                  }}
                >
                  <UserPlus aria-hidden="true" size={16} />
                  <div>
                    <strong>New Client</strong>
                    <small>Add client & managed properties</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onNavigate("joseph");
                  }}
                >
                  <MessageCircle aria-hidden="true" size={16} />
                  <div>
                    <strong>Ask Joseph Assistant</strong>
                    <small>Next-stop brief & voice dispatch</small>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
