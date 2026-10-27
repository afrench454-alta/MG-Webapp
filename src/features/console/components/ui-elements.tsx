import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileCheck2 } from "lucide-react";
import type { Invoice, Quote } from "../domain";

export type BadgeTone =
  | "neutral"
  | "sage"
  | "forest"
  | "olive"
  | "amber"
  | "success"
  | "unpaid"
  | "red";

export type ButtonVariant = "primary" | "secondary" | "success" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: LucideIcon;
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
};

export type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function quoteStatusTone(status: Quote["status"]): BadgeTone {
  if (status === "Accepted") return "success";
  if (status === "Sent") return "olive";
  if (status === "Declined" || status === "Expired") return "amber";
  if (status === "Void") return "red";
  return "neutral";
}

export function documentStatusTone(status: Invoice["documentStatus"]): BadgeTone {
  if (status === "Issued" || status === "Sent") return "success";
  if (status === "Overdue") return "unpaid";
  if (status === "Void") return "red";
  return "amber";
}

export function paymentStatusTone(status: Invoice["paymentStatus"]): BadgeTone {
  if (status === "Paid") return "success";
  if (status === "Part paid") return "amber";
  if (status === "Refunded") return "neutral";
  return "unpaid";
}

export function invoiceDisplayTone(
  status: "Draft" | "Issued" | "Sent" | "Overdue" | "Part paid" | "Paid" | "Refunded" | "Void",
): BadgeTone {
  if (status === "Paid" || status === "Issued" || status === "Sent") return "success";
  if (status === "Part paid") return "amber";
  if (status === "Overdue") return "unpaid";
  if (status === "Void") return "red";
  if (status === "Refunded") return "neutral";
  return "amber";
}

export function Button({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.9} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  tone = "default",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`icon-button icon-button--${tone} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
    </button>
  );
}

export function jobStatusTone(
  status:
    | "unscheduled"
    | "scheduled"
    | "in-progress"
    | "on-hold"
    | "completed"
    | "cancelled"
    | "Ready to Invoice",
): BadgeTone {
  if (status === "completed") return "success";
  if (status === "in-progress") return "forest";
  if (status === "scheduled") return "sage";
  if (status === "on-hold" || status === "Ready to Invoice") return "amber";
  if (status === "cancelled") return "red";
  return "neutral";
}

export function clientStatusTone(status: "Lead" | "Active" | "Inactive"): BadgeTone {
  if (status === "Active") return "success";
  if (status === "Lead") return "amber";
  return "neutral";
}

export function requestStatusTone(
  status: "New" | "Qualified" | "Quoting" | "Scheduled" | "Closed" | "Rejected",
): BadgeTone {
  if (status === "Scheduled") return "success";
  if (status === "Quoting" || status === "Qualified") return "olive";
  if (status === "New") return "amber";
  if (status === "Rejected") return "red";
  return "neutral";
}

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "bg-slate-500/10 text-slate-700 border-slate-500/25 dark:text-slate-300",
  sage: "bg-teal-500/10 text-teal-800 border-teal-500/25 dark:text-teal-300",
  forest:
    "bg-sky-500/10 text-sky-800 border-sky-500/25 dark:text-sky-300",
  olive:
    "bg-indigo-500/10 text-indigo-800 border-indigo-500/25 dark:text-indigo-300",
  amber:
    "bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-300",
  success:
    "bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:text-emerald-300",
  unpaid:
    "bg-orange-500/10 text-orange-800 border-orange-500/25 dark:text-orange-300",
  red: "bg-rose-500/10 text-rose-800 border-rose-500/25 dark:text-rose-300",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`badge badge--${tone} ${BADGE_TONE_CLASSES[tone]} text-xs font-medium px-2 py-0.5 rounded-md border tabular-nums ${className}`.trim()}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <FileCheck2 aria-hidden="true" size={28} />
      <p>{title}</p>
      {action ? (
        <button onClick={onAction}>
          {action} <ArrowRight aria-hidden="true" size={15} />
        </button>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function matchesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export type FilterChip<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<FilterChip<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="filter-group" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`filter-chip${selected ? " filter-chip--active" : ""}${
              option.id === "voided" ? " filter-chip--voided" : ""
            }`}
            onClick={() => onChange(option.id)}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span className="filter-chip__count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

