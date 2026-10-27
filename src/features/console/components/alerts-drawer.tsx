"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  money,
  quoteTotals,
  type ConsoleRoute,
  type Invoice,
  type Job,
  type JobRequest,
  type QuestionnaireSubmission,
  type Quote,
} from "../domain";
import { invoiceDisplayStatus } from "../data/invoice-lifecycle";
import { isLiveInvoice, isLiveQuote } from "../data/list-filters";
import { displayServiceCategory } from "../data/service-catalog";
import { formatSiteTitle } from "../data/work-identity";
import { Badge, IconButton } from "./ui-elements";

export type AlertItem = {
  id: string;
  category: "urgent" | "intake" | "billing";
  tone: "red" | "amber" | "olive" | "forest";
  tag: string;
  title: string;
  detail: string;
  meta: string;
  ctaLabel: string;
  onAction: () => void;
};

export function AlertsDrawer({
  open,
  onClose,
  jobs,
  jobRequests,
  quotes,
  invoices,
  submissions,
  canManage,
  onNavigate,
  onOpenJob,
  onOpenQuote,
  onOpenInvoice,
  onOpenSubmission,
  onScheduleJob,
}: {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
  jobRequests: JobRequest[];
  quotes: Quote[];
  invoices: Invoice[];
  submissions: QuestionnaireSubmission[];
  canManage: boolean;
  onNavigate: (route: ConsoleRoute) => void;
  onOpenJob: (job: Job) => void;
  onOpenQuote: (quote: Quote) => void;
  onOpenInvoice: (invoice: Invoice) => void;
  onOpenSubmission: (submission: QuestionnaireSubmission) => void;
  onScheduleJob: () => void;
}) {
  const [tab, setTab] = useState<"all" | "urgent" | "intake">("all");
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    sheetRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const items = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];

    if (canManage) {
      for (const inv of invoices.filter(isLiveInvoice)) {
        const status = invoiceDisplayStatus(inv);
        if (status === "Overdue") {
          const total = quoteTotals(
            inv.items,
            inv.discount ?? 0,
            inv.taxRate ?? 0,
          ).total;
          list.push({
            id: `overdue-${inv.id}`,
            category: "urgent",
            tone: "red",
            tag: "Overdue Invoice",
            title: `${inv.documentNumber || inv.id} · ${inv.client}`,
            detail: `${inv.address} · Due ${inv.dueDate}`,
            meta: `${money(total)} outstanding`,
            ctaLabel: "Review Invoice",
            onAction: () => {
              onClose();
              onOpenInvoice(inv);
            },
          });
        }
      }
    }

    for (const job of jobs) {
      if (job.status === "on-hold") {
        list.push({
          id: `hold-${job.id}`,
          category: "urgent",
          tone: "amber",
          tag: "Job On Hold",
          title: formatSiteTitle(job),
          detail: job.notes || `${displayServiceCategory(job.category)} · ${job.address}`,
          meta: `${job.date}${job.time ? ` · ${job.time}` : ""}`,
          ctaLabel: "Open Job Card",
          onAction: () => {
            onClose();
            onOpenJob(job);
          },
        });
      } else if (
        (job.status === "scheduled" || job.status === "in-progress") &&
        job.assigneeIds.length === 0
      ) {
        list.push({
          id: `unassigned-${job.id}`,
          category: "urgent",
          tone: "amber",
          tag: "Unassigned Crew",
          title: formatSiteTitle(job),
          detail: `${displayServiceCategory(job.category)} has no assigned crew member.`,
          meta: `${job.date}${job.time ? ` · ${job.time}` : ""}`,
          ctaLabel: "Assign Crew",
          onAction: () => {
            onClose();
            onOpenJob(job);
          },
        });
      }
    }

    for (const req of jobRequests) {
      if (req.status === "New" || req.status === "Quoting") {
        list.push({
          id: `req-${req.id}`,
          category: "intake",
          tone: "olive",
          tag: `Request · ${req.status}`,
          title: formatSiteTitle(req),
          detail: req.scope || displayServiceCategory(req.category),
          meta: `Logged ${req.created}`,
          ctaLabel: canManage ? "Schedule or Quote" : "View Request",
          onAction: () => {
            onClose();
            onNavigate("requests");
          },
        });
      }
    }

    if (canManage) {
      for (const sub of submissions) {
        if (!sub.jobRequestId) {
          list.push({
            id: `sub-${sub.id}`,
            category: "intake",
            tone: "forest",
            tag: "New Intake Submission",
            title: `${sub.respondent} · ${sub.questionnaire}`,
            detail: sub.email,
            meta: `Submitted ${sub.submitted}`,
            ctaLabel: "Review Answers",
            onAction: () => {
              onClose();
              onOpenSubmission(sub);
            },
          });
        }
      }

      for (const quote of quotes.filter(isLiveQuote)) {
        if (quote.status === "Draft" || quote.status === "Sent") {
          const total = quoteTotals(
            quote.items,
            quote.discount ?? 0,
            quote.taxRate ?? 0,
          ).total;
          list.push({
            id: `quote-${quote.id}`,
            category: "billing",
            tone: "amber",
            tag: `Quote ${quote.status}`,
            title: `${quote.documentNumber || quote.id} · ${quote.client}`,
            detail: quote.scope || quote.address,
            meta: `${money(total)} · Expires ${quote.expires}`,
            ctaLabel: "Open Quote",
            onAction: () => {
              onClose();
              onOpenQuote(quote);
            },
          });
        }
      }
    }

    return list;
  }, [
    canManage,
    invoices,
    jobRequests,
    jobs,
    onClose,
    onNavigate,
    onOpenInvoice,
    onOpenJob,
    onOpenQuote,
    onOpenSubmission,
    quotes,
    submissions,
  ]);

  const filtered = useMemo(() => {
    if (tab === "urgent") {
      return items.filter((item) => item.category === "urgent");
    }
    if (tab === "intake") {
      return items.filter(
        (item) => item.category === "intake" || item.category === "billing",
      );
    }
    return items;
  }, [items, tab]);

  if (!open) return null;

  return (
    <div
      className="alerts-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <aside
        id="operational-alerts-drawer"
        className="alerts-drawer"
        aria-label="Operational alerts and feed"
        tabIndex={-1}
        ref={sheetRef}
      >
        <header className="alerts-drawer__header">
          <div>
            <p className="eyebrow">Live Dispatch Feed</p>
            <h2>Operational Alerts ({items.length})</h2>
          </div>
          <IconButton
            label="Close alerts drawer"
            icon={X}
            onClick={onClose}
          />
        </header>

        <div className="alerts-drawer__tabs" role="tablist" aria-label="Filter alerts">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "all"}
            className={tab === "all" ? "is-active" : ""}
            onClick={() => setTab("all")}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "urgent"}
            className={tab === "urgent" ? "is-active" : ""}
            onClick={() => setTab("urgent")}
          >
            Urgent ({items.filter((i) => i.category === "urgent").length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "intake"}
            className={tab === "intake" ? "is-active" : ""}
            onClick={() => setTab("intake")}
          >
            Intake & Billing (
            {
              items.filter(
                (i) => i.category === "intake" || i.category === "billing",
              ).length
            }
            )
          </button>
        </div>

        <div className="alerts-drawer__body">
          {filtered.length ? (
            <ul className="alerts-drawer__list" role="list">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className={`alert-card alert-card--${item.tone}`}
                >
                  <div className="alert-card__top">
                    <Badge
                      tone={
                        item.tone === "red"
                          ? "unpaid"
                          : item.tone === "amber"
                            ? "amber"
                            : item.tone === "olive"
                              ? "olive"
                              : "forest"
                      }
                    >
                      {item.tag}
                    </Badge>
                    <small>{item.meta}</small>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <div className="alert-card__footer">
                    <button
                      type="button"
                      className="text-link"
                      onClick={item.onAction}
                    >
                      {item.ctaLabel}{" "}
                      <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="alerts-drawer__empty">
              <CheckCircle2 aria-hidden="true" size={28} />
              <strong>All caught up</strong>
              <p>No operational alerts require attention in this filter.</p>
              {canManage ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    onClose();
                    onScheduleJob();
                  }}
                >
                  Schedule a Job
                </button>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
