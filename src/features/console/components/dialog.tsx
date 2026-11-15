"use client";

import { useId, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconButton } from "./ui-elements";
import { useModalFocus } from "./use-modal-focus";

export type DialogProps = {
  title: string;
  titleIcon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  document?: boolean;
};

export function Dialog({
  title, titleIcon: TitleIcon, onClose, children, wide = false, document: isDocument = false,
}: DialogProps) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  useModalFocus(panel, true, onClose);

  return (
    <div className="dialog-backdrop" onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className={`dialog ${wide ? "dialog--wide" : ""} ${isDocument ? "dialog--document" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
      >
        <div className="dialog__accent" aria-hidden="true" />
        <div className="dialog__header">
          <h2 id={titleId}>
            {TitleIcon ? <TitleIcon aria-hidden="true" size={19} /> : null}
            {title}
          </h2>
          <div className="dialog__header-controls">
            <kbd className="dialog__esc-pill" aria-hidden="true">ESC</kbd>
            <IconButton label="Close dialog" icon={X} onClick={onClose} />
          </div>
        </div>
        <div className="dialog__body">{children}</div>
      </section>
    </div>
  );
}
