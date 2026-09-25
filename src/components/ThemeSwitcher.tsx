"use client";

import { useEffect, useRef } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "noc_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function parseTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
}

export function ThemeSwitcher() {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const select = selectRef.current!;
    try {
      select.value = parseTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      // The system default still works when browser storage is unavailable.
      select.value = "system";
    }
    applyTheme(parseTheme(select.value));

    const media = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => {
      if (select.value === "system") applyTheme("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        select.value = parseTheme(event.newValue);
        applyTheme(parseTheme(select.value));
      }
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <select
      ref={selectRef}
      defaultValue="system"
      aria-label="Theme"
      className="rounded border border-slate-200 bg-background px-2 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
      onChange={(event) => {
        const theme = parseTheme(event.target.value);
        applyTheme(theme);
        try {
          localStorage.setItem(STORAGE_KEY, theme);
        } catch {
          // Keep the selected theme active even if persistence is blocked.
        }
      }}
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System Default</option>
    </select>
  );
}
