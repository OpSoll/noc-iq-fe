"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  keywords: string[];
  action: () => void;
  context?: string;
}

interface WebhookCommandPaletteProps {
  actions: CommandAction[];
  isOpen: boolean;
  onClose: () => void;
}

export default function WebhookCommandPalette({
  actions,
  isOpen,
  onClose,
}: WebhookCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) ||
          a.keywords.some((k) => k.toLowerCase().includes(query.toLowerCase())),
      )
    : actions;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose],
  );

  // Register global shortcut (Ctrl+K)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center bg-black/30 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or filter..."
            className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            autoComplete="off"
            aria-label="Search commands"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No matching commands
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((action, idx) => (
                <button
                  key={action.id}
                  onClick={() => {
                    action.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    idx === selectedIndex
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{action.label}</span>
                    {action.context && (
                      <span className="text-xs text-slate-400">
                        {action.context}
                      </span>
                    )}
                  </div>
                  {action.shortcut && (
                    <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-2">
          <div className="flex gap-4 text-[10px] text-slate-400">
            <span>
              <kbd className="rounded border border-slate-200 px-1 font-mono">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded border border-slate-200 px-1 font-mono">↵</kbd> Select
            </span>
            <span>
              <kbd className="rounded border border-slate-200 px-1 font-mono">Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Pre-built actions for webhook page
export function getWebhookCommandActions(
  filters: { status?: string; event?: string },
  onFilter: (f: { status?: string; event?: string }) => void,
  onReplay: () => void,
  onMute: () => void,
  onInspect: () => void,
): CommandAction[] {
  return [
    {
      id: "filter-failed",
      label: "Filter failed deliveries",
      shortcut: "f f",
      keywords: ["filter", "failed", "dead", "letter", "error"],
      action: () => onFilter({ ...filters, status: "failed" }),
      context: "status=failed",
    },
    {
      id: "filter-success",
      label: "Filter successful deliveries",
      shortcut: "f s",
      keywords: ["filter", "success", "ok", "delivered"],
      action: () => onFilter({ ...filters, status: "success" }),
      context: "status=success",
    },
    {
      id: "filter-all",
      label: "Show all deliveries",
      shortcut: "f a",
      keywords: ["filter", "all", "clear", "reset"],
      action: () => onFilter({}),
      context: "clear filters",
    },
    {
      id: "replay-failed",
      label: "Replay all failed",
      shortcut: "r f",
      keywords: ["replay", "retry", "failed", "dead", "letter"],
      action: () => onReplay(),
      context: "re-queue failed",
    },
    {
      id: "mute-webhook",
      label: "Mute selected webhook",
      shortcut: "m w",
      keywords: ["mute", "silence", "disable", "pause"],
      action: () => onMute(),
      context: "disable notifications",
    },
    {
      id: "inspect-delivery",
      label: "Inspect delivery details",
      shortcut: "i d",
      keywords: ["inspect", "detail", "view", "payload", "headers"],
      action: () => onInspect(),
      context: "view payload",
    },
  ];
}
