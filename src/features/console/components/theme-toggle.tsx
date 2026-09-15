"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  oppositeTheme,
  persistConsoleTheme,
  readStoredTheme,
  subscribeTheme,
  type ConsoleTheme,
} from "../theme";

export function ThemeToggle() {
  const theme = useSyncExternalStore<ConsoleTheme>(
    subscribeTheme,
    readStoredTheme,
    () => "light",
  );
  const next = oppositeTheme(theme);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={theme === "dark"}
      aria-label={`Switch to ${next} mode`}
      onClick={() => persistConsoleTheme(next)}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" size={18} strokeWidth={1.8} />
      ) : (
        <Moon aria-hidden="true" size={18} strokeWidth={1.8} />
      )}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
