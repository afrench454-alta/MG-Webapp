"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const focusSelector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useModalFocus(panelRef: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(panel.closest(".app-shell")?.children ?? []).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && !element.contains(panel) && !element.inert,
    );
    for (const sibling of siblings) sibling.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(focusSelector))
      .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled, [aria-disabled=true]") && element.getClientRects().length > 0);
    (focusable()[0] ?? panel).focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      for (const sibling of siblings) sibling.inert = false;
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [active, panelRef]);
}
