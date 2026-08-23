"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconButton } from "./ui-elements";

export type DialogProps = {
  title: string;
  titleIcon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  document?: boolean;
};

export function Dialog({
  title,
  titleIcon: TitleIcon,
  onClose,
  children,
  wide = false,
  document: isDocument = false,
}: DialogProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Accessible Focus Trap within dialog
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);

    // Initial focus on first input/button
    const firstInteractive = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    firstInteractive?.focus();

    // Prevent background scroll
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) =>
        event.target === event.currentTarget && onClose()
      }
      role="presentation"
    >
      <section
        className={`dialog ${wide ? "dialog--wide" : ""} ${isDocument ? "dialog--document" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={panelRef}
      >
        <div className="dialog__header">
          <h2 id="dialog-title">
            {TitleIcon ? <TitleIcon aria-hidden="true" size={19} /> : null}
            {title}
          </h2>
          <IconButton label="Close dialog" icon={X} onClick={onClose} />
        </div>
        <div className="dialog__body">{children}</div>
      </section>
    </div>
  );
}
