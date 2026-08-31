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

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
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

