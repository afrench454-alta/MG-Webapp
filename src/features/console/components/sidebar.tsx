"use client";

import Image from "next/image";
import {
  CalendarDays,
  ClipboardList,
  Columns3,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ReceiptText,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productBrand } from "@/lib/brand";
import type { ConsoleRoute } from "../domain";
import { IconButton } from "./ui-elements";
import { InstallAppButton } from "./install-app";
import { ThemeToggle } from "./theme-toggle";

export type NavSection = "Field Operations" | "Client & Intake" | "Financials & Admin";

export const navItems: Array<{
  id: ConsoleRoute;
  label: string;
  icon: LucideIcon;
  section: NavSection;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "Field Operations",
  },
  {
    id: "joseph",
    label: "Joseph",
    icon: MessageCircle,
    section: "Field Operations",
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: CalendarDays,
    section: "Field Operations",
  },
  {
    id: "jobs",
    label: "Job Board",
    icon: Columns3,
    section: "Field Operations",
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    section: "Client & Intake",
  },
  {
    id: "requests",
    label: "Job Requests",
    icon: ClipboardList,
    section: "Client & Intake",
  },
  {
    id: "questionnaires",
    label: "Intake forms",
    icon: FileText,
    section: "Client & Intake",
  },
  {
    id: "quotes",
    label: "Quotes",
    icon: ReceiptText,
    section: "Financials & Admin",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: DollarSign,
    section: "Financials & Admin",
  },
  {
    id: "settings",
    label: "Team & business",
    icon: Settings,
    section: "Financials & Admin",
  },
];

const fieldRoutes: ConsoleRoute[] = [
  "dashboard",
  "joseph",
  "requests",
  "schedule",
  "jobs",
];

export function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onClose,
  signedInEmail,
  onSignOut,
  canManage = true,
  counts,
}: {
  active: ConsoleRoute;
  onNavigate: (route: ConsoleRoute) => void;
  mobileOpen: boolean;
  onClose: () => void;
  signedInEmail: string;
  onSignOut?: () => Promise<void>;
  canManage?: boolean;
  counts?: Partial<Record<ConsoleRoute, number>>;
}) {
  const allowedItems = navItems.filter((item) =>
    canManage ? true : fieldRoutes.includes(item.id),
  );

  const sections: NavSection[] = canManage
    ? ["Field Operations", "Client & Intake", "Financials & Admin"]
    : ["Field Operations"];

  return (
    <aside
      id="console-sidebar"
      className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}
    >
      <div className="brand-lockup">
        <Image
          src="/mow-glow-logo.png"
          alt=""
          width={36}
          height={36}
          className="brand-lockup__mark"
        />
        <div className="brand-lockup__text">
          <p>{productBrand}</p>
          <strong>Console</strong>
        </div>
        <IconButton
          label="Close navigation"
          icon={X}
          className="sidebar__close"
          onClick={onClose}
        />
      </div>

      <nav aria-label="Main navigation" className="sidebar-nav">
        {sections.map((section) => {
          const items = allowedItems.filter((item) => item.section === section);
          if (!items.length) return null;

          return (
            <div className="sidebar-nav__group" key={section}>
              <span className="sidebar-nav__heading" aria-hidden="true">
                {section}
              </span>
              <div className="sidebar-nav__items">
                {items.map((item) => {
                  const Icon = item.icon;
                  const badgeCount = counts?.[item.id];
                  const isActive = active === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-nav__item ${isActive ? "is-active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                    >
                      <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
                      <span className="sidebar-nav__label">{item.label}</span>
                      {typeof badgeCount === "number" && badgeCount > 0 ? (
                        <small
                          className="sidebar-nav__badge"
                          aria-hidden="true"
                        >
                          {badgeCount}
                        </small>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
        <InstallAppButton />
        <div className="signed-in">
          <p className="eyebrow">Signed in</p>
          <strong>{signedInEmail}</strong>
          {onSignOut ? (
            <form action={onSignOut}>
              <button type="submit">
                <LogOut aria-hidden="true" size={15} /> Sign out
              </button>
            </form>
          ) : (
            <button type="button">
              <LogOut aria-hidden="true" size={15} /> Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
