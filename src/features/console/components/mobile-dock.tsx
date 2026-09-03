"use client";

import {
  CalendarDays,
  Columns3,
  DollarSign,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ConsoleRoute } from "../domain";

const dockItems: Array<{
  id: ConsoleRoute;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Columns3 },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: DollarSign },
];

export function MobileDock({
  active,
  menuOpen,
  onNavigate,
  onMore,
}: {
  active: ConsoleRoute;
  menuOpen: boolean;
  onNavigate: (route: ConsoleRoute) => void;
  onMore: () => void;
}) {
  return (
    <nav className="mobile-dock" aria-label="Quick navigation">
      {dockItems.map((item) => {
        const Icon = item.icon;
        const selected = !menuOpen && active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={selected ? "is-active" : ""}
            aria-current={selected ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={menuOpen ? "is-active" : ""}
        aria-expanded={menuOpen}
        aria-controls="console-sidebar"
        onClick={onMore}
      >
        <Menu aria-hidden="true" size={20} strokeWidth={1.8} />
        <span>More</span>
      </button>
    </nav>
  );
}
