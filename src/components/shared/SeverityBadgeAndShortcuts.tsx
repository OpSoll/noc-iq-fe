"use client";
import { useEffect, useState } from "react";
// Closes #373: outage severity badge system with WCAG-compliant colors
// Closes #374: keyboard shortcut guide overlay

const SEVERITY_STYLE = {
  critical: { className: "bg-red-900 text-red-50", icon: "▲" },
  high: { className: "bg-orange-800 text-orange-50", icon: "◆" },
  medium: { className: "bg-yellow-700 text-yellow-50", icon: "●" },
  low: { className: "bg-slate-600 text-slate-50", icon: "○" },
} as const;

export function SeverityBadge({ severity }: { severity: keyof typeof SEVERITY_STYLE }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${s.className}`}>
      <span aria-hidden>{s.icon}</span>
      {severity}
    </span>
  );
}

const SHORTCUTS = [
  { keys: "j / k", action: "Move to next / previous outage" },
  { keys: "enter", action: "Open detail panel" },
  { keys: "r", action: "Trigger SLA recalculation" },
  { keys: "?", action: "Toggle this guide" },
];

export function KeyboardShortcutGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?") setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Keyboard shortcuts" className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-background p-4 text-sm">
        <h2 className="mb-2 font-semibold">Keyboard Shortcuts</h2>
        <ul className="space-y-1">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex justify-between gap-4">
              <kbd className="font-mono">{s.keys}</kbd>
              <span>{s.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
