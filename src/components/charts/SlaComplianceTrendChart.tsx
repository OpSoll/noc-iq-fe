"use client";
import { useState } from "react";
// Closes #358: SLA compliance trend chart with configurable time windows
// Closes #352: minimal locale infrastructure used for date formatting
const LOCALE_KEY = "noc_locale";
export function useLocale() {
  const [locale, setLocale] = useState(() => {
    return (
      (typeof window !== "undefined"
        ? localStorage.getItem(LOCALE_KEY)
        : null) ?? "en-US"
    );
  });
  const changeLocale = (next: string) => {
    setLocale(next);
    if (typeof window !== "undefined") localStorage.setItem(LOCALE_KEY, next);
  };
  return { locale, changeLocale };
}
export type SlaTrendPoint = { date: string; compliancePct: number };
const WINDOWS = { "7d": 7, "30d": 30, "90d": 90 } as const;
type WindowKey = keyof typeof WINDOWS;
export function SlaComplianceTrendChart({
  points,
}: {
  points: SlaTrendPoint[];
}) {
  const { locale } = useLocale();
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const visible = points.slice(-WINDOWS[windowKey]);
  const max = Math.max(100, ...visible.map((p) => p.compliancePct));
  const path = visible
    .map((p, i) => {
      const x = (i / Math.max(visible.length - 1, 1)) * 300;
      return `${i === 0 ? "M" : "L"}${x},${80 - (p.compliancePct / max) * 80}`;
    })
    .join(" ");
  const last = visible[visible.length - 1];
  return (
    <div>
      <div className="flex gap-2 mb-2 text-sm">
        {(Object.keys(WINDOWS) as WindowKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setWindowKey(k)}
            className={k === windowKey ? "font-bold" : ""}
          >
            {k}
          </button>
        ))}
      </div>
      <svg 
        width={300} 
        height={80} 
        role="group" 
        aria-label="SLA compliance trend"
        tabIndex={0}
      >
        <title>SLA Compliance Trend Chart</title>
        <desc>Line chart showing the SLA compliance trend over {windowKey}</desc>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
      {last && (
        <p className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat(locale).format(new Date(last.date))}
        </p>
      )}
    </div>
  );
}
