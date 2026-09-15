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
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { productBrand } from "@/lib/brand";
import type { ConsoleRoute } from "../domain";
import { IconButton } from "./ui-elements";
import { InstallAppButton } from "./install-app";
import { ThemeToggle } from "./theme-toggle";

export const navItems: Array<{ id: ConsoleRoute; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "joseph", label: "Joseph", icon: MessageCircle },
  { id: "clients", label: "Clients", icon: Users },
  { id: "requests", label: "Job Requests", icon: ClipboardList },
  { id: "questionnaires", label: "Intake forms", icon: FileText },
  { id: "quotes", label: "Quotes", icon: ReceiptText },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "jobs", label: "Job Board", icon: Columns3 },
  { id: "invoices", label: "Invoices", icon: DollarSign },
  { id: "settings", label: "Team & business", icon: Settings },
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
  onEstimate,
  mobileOpen,
  onClose,
  signedInEmail,
  onSignOut,
  canManage = true,
}: {
  active: ConsoleRoute;
  onNavigate: (route: ConsoleRoute) => void;
  onEstimate: () => void;
  mobileOpen: boolean;
  onClose: () => void;
  signedInEmail: string;
  onSignOut?: () => Promise<void>;
  canManage?: boolean;
}) {
  return (
    <aside
      id="console-sidebar"
      className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}
    >
      <div className="brand-lockup">
        <Image
          src="/mow-glow-logo.png"
          alt=""
          width={40}
          height={40}
          className="brand-lockup__mark"
        />
        <div>
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
        {navItems
          .filter((item) =>
            canManage ? true : fieldRoutes.includes(item.id),
          )
          .map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={active === item.id ? "is-active" : ""}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {canManage ? (
          <button className="ai-button" type="button" onClick={onEstimate}>
            <Sparkles aria-hidden="true" size={18} />
            <span>AI Estimator</span>
          </button>
        ) : null}
        <ThemeToggle />
        <InstallAppButton />
        <div className="signed-in">
          <p className="eyebrow">Signed in</p>
          <strong>{signedInEmail}</strong>
          {onSignOut ? (
            <form action={onSignOut}>
              <button type="submit">
                <LogOut aria-hidden="true" size={16} /> Sign out
              </button>
            </form>
          ) : (
            <button type="button">
              <LogOut aria-hidden="true" size={16} /> Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
