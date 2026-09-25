"use client";

import { useEffect } from "react";

function applyPhoneAttr() {
  const root = document.documentElement;
  const shortSide = Math.min(window.screen.width || 0, window.screen.height || 0);
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && shortSide <= 926) root.setAttribute("data-phone", "true");
  else root.removeAttribute("data-phone");
}

export function PhoneShellSync() {
  useEffect(() => {
    applyPhoneAttr();
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    coarseQuery.addEventListener("change", applyPhoneAttr);
    window.addEventListener("orientationchange", applyPhoneAttr);
    window.addEventListener("resize", applyPhoneAttr);
    return () => {
      coarseQuery.removeEventListener("change", applyPhoneAttr);
      window.removeEventListener("orientationchange", applyPhoneAttr);
      window.removeEventListener("resize", applyPhoneAttr);
    };
  }, []);

  return null;
}
