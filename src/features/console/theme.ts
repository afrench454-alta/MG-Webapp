export const THEME_STORAGE_KEY = "mg-console-theme";

export type ConsoleTheme = "light" | "dark";

type ThemeListener = () => void;

const listeners = new Set<ThemeListener>();

export function isConsoleTheme(value: string | null | undefined): value is ConsoleTheme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): ConsoleTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isConsoleTheme(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function applyConsoleTheme(theme: ConsoleTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export function persistConsoleTheme(theme: ConsoleTheme) {
  applyConsoleTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing can block storage; the in-session attribute still applies.
  }
  for (const listener of listeners) listener();
}

export function subscribeTheme(listener: ThemeListener) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function oppositeTheme(theme: ConsoleTheme): ConsoleTheme {
  return theme === "dark" ? "light" : "dark";
}
