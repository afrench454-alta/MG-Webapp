"use client";

import { useEffect, useSyncExternalStore } from "react";

function hasPhonePointer() {
  const shortSide = Math.min(window.screen.width || 0, window.screen.height || 0);
  return shortSide > 0 && shortSide <= 926 &&
    window.matchMedia("(pointer: coarse)").matches;
}

function subscribeToPhoneLayout(onChange: () => void) {
  const coarse = window.matchMedia("(pointer: coarse)");
  coarse.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    coarse.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function usePhoneLayout() {
  return useSyncExternalStore(
    subscribeToPhoneLayout,
    () => window.matchMedia("(max-width: 760px)").matches || hasPhonePointer(),
    () => false,
  );
}

function applyPhoneAttr() {
  const root = document.documentElement;
  if (hasPhonePointer()) root.setAttribute("data-phone", "true");
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
