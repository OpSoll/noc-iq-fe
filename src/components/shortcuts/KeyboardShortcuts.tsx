"use client";

import { useState, useEffect } from "react";
import { useKeyboardNavigation, getScopeForPath, type ShortcutBinding } from "@/hooks/useKeyboardNavigation";
import { usePathname } from "next/navigation";

interface KeyboardShortcutsProps {
  extraBindings?: ShortcutBinding[];
}

export default function KeyboardShortcuts({ extraBindings = [] }: KeyboardShortcutsProps) {
  const [showPalette, setShowPalette] = useState(false);
  const pathname = usePathname();
  const scope = getScopeForPath(pathname);

  const helpBinding: ShortcutBinding = {
    key: "?",
    description: "Show keyboard shortcuts",
    action: () => setShowPalette((v) => !v),
  };

  const escBinding: ShortcutBinding = {
    key: "Escape",
    description: "Close",
    action: () => setShowPalette(false),
  };

  const { bindings } = useKeyboardNavigation([...extraBindings, helpBinding, escBinding]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setShowPalette((v) => !v);
      }
      if (e.key === "Escape") {
        setShowPalette(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const currentScopeBindings = bindings.filter(
    (b) => !b.scope || b.scope === "global" || b.scope === scope,
  );

  const groupedBindings = currentScopeBindings.reduce(
    (acc, b) => {
      const group = b.scope || "global";
      if (!acc[group]) acc[group] = [];
      acc[group].push(b);
      return acc;
    },
    {} as Record<string, ShortcutBinding[]>,
  );

  if (!showPalette) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30"
      onClick={() => setShowPalette(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Keyboard Shortcuts</h2>
          <button
            onClick={() => setShowPalette(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {Object.entries(groupedBindings).map(([group, groupBindings]) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group === "global" ? "Global" : group}
              </h3>
              <div className="space-y-1">
                {groupBindings.map((binding, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="text-slate-600">{binding.description}</span>
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-500">
                      {binding.ctrl && "Ctrl+"}
                      {binding.meta && "Cmd+"}
                      {binding.shift && "Shift+"}
                      {binding.key === "?" ? "?" : binding.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
