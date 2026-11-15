"use client";

import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import type { OperationalAlert } from "../data/operational-alerts";
import { Badge, IconButton } from "./ui-elements";
import { useModalFocus } from "./use-modal-focus";

export function AlertsDrawer({ open, onClose, items, onOpen }: {
  open: boolean;
  onClose: () => void;
  items: OperationalAlert[];
  onOpen: (alert: OperationalAlert) => void;
}) {
  const [tab, setTab] = useState<"all" | "urgent" | "other">("all");
  const sheet = useRef<HTMLElement>(null);
  useModalFocus(sheet, open, onClose);
  if (!open) return null;
  const urgent = items.filter((item) => item.urgent).length;
  const filters = [
    { id: "all", label: "All", count: items.length },
    { id: "urgent", label: "Urgent", count: urgent },
    { id: "other", label: "Other", count: items.length - urgent },
  ] as const;
  const visible = tab === "all" ? items : items.filter((item) => item.urgent === (tab === "urgent"));
  return (
    <div className="alerts-drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside
        id="operational-alerts-drawer"
        className="alerts-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operational-alerts-title"
        tabIndex={-1}
        ref={sheet}
      >
        <header className="alerts-drawer__header">
          <h2 id="operational-alerts-title">Operational alerts ({items.length})</h2>
          <IconButton label="Close alerts drawer" icon={X} onClick={onClose} />
        </header>
        <div className="alerts-drawer__tabs" role="group" aria-label="Filter alerts">
          {filters.map((filter) => (
            <button key={filter.id} type="button" aria-pressed={tab === filter.id}
              className={tab === filter.id ? "is-active" : ""} onClick={() => setTab(filter.id)}>
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
        <div className="alerts-drawer__body">
          {visible.length ? (
            <ul className="alerts-drawer__list">
              {visible.map((item) => (
                <li key={item.id} className={`alert-card alert-card--${item.urgent ? "amber" : "olive"}`}>
                  <div className="alert-card__top">
                    <Badge tone={item.urgent ? "amber" : "olive"}>{item.tag}</Badge>
                    {item.meta ? <small>{item.meta}</small> : null}
                  </div>
                  <h3>{item.title}</h3>
                  {item.detail ? <p>{item.detail}</p> : null}
                  <div className="alert-card__footer">
                    <button type="button" className="text-link" onClick={() => onOpen(item)}>
                      {item.action} <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="alerts-drawer__empty">
              <CheckCircle2 aria-hidden="true" size={28} />
              <strong>All caught up</strong>
              <p>No alerts in this view.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
