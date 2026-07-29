import { useEffect, useState } from "react";
// Closes #375: full-text outage search with debounced input
// Closes #376: dashboard widget layout persistence

export function useDebouncedOutageSearch(delayMs = 300) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), delayMs);
    return () => clearTimeout(timer);
  }, [query, delayMs]);

  return { query, setQuery, debouncedQuery: debounced };
}

const LAYOUT_KEY = "noc_dashboard_widget_order";

export function useDashboardWidgetLayout(defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultOrder;
    const stored = localStorage.getItem(LAYOUT_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // ignore malformed stored layout, keep default
      }
    }
    return defaultOrder;
  });

  function moveWidget(id: string, toIndex: number) {
    setOrder((prev) => {
      const next = prev.filter((w) => w !== id);
      next.splice(toIndex, 0, id);
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { order, moveWidget };
}
