"use client";

import { useState, useEffect } from "react";

export interface ConflictInfo {
  type: "concurrent-session" | "stale-state";
  message: string;
  affectedActions: string[];
  severity: "warning" | "error";
}

interface ConflictNotificationProps {
  conflict: ConflictInfo;
  onRefreshContext: () => void;
  onDismiss: () => void;
}

export function ConflictNotification({
  conflict,
  onRefreshContext,
  onDismiss,
}: ConflictNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [conflict]);

  if (!visible) return null;

  const bgColor = conflict.severity === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div
      role="alert"
      className={`fixed top-4 right-4 z-[200] max-w-md rounded-lg border p-4 shadow-lg ${bgColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold">
            {conflict.type === "concurrent-session" ? "Session Conflict Detected" : "Stale State Warning"}
          </p>
          <p className="text-xs">{conflict.message}</p>
          {conflict.affectedActions.length > 0 && (
            <p className="text-xs font-medium">
              Affected actions: {conflict.affectedActions.join(", ")}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                onRefreshContext();
                setVisible(false);
              }}
              className="rounded bg-white/80 px-3 py-1 text-xs font-medium hover:bg-white"
            >
              Refresh security context
            </button>
            <button
              onClick={() => {
                onDismiss();
                setVisible(false);
              }}
              className="rounded px-3 py-1 text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 opacity-60 hover:opacity-100"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function useConflictDetection() {
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    function handleConflictEvent(e: Event) {
      const detail = (e as CustomEvent<ConflictInfo>).detail;
      setConflict(detail);
    }

    window.addEventListener("session:conflict", handleConflictEvent as EventListener);
    return () => window.removeEventListener("session:conflict", handleConflictEvent as EventListener);
  }, []);

  function emitConflictTelemetry(info: ConflictInfo) {
    try {
      const payload = {
        type: info.type,
        message: info.message,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("noc_conflict_telemetry", JSON.stringify(payload));
    } catch {
      // telemetry storage unavailable
    }
  }

  const notify = (info: ConflictInfo) => {
    setConflict(info);
    emitConflictTelemetry(info);
  };

  const dismiss = () => setConflict(null);
  const refreshContext = () => {
    window.dispatchEvent(new Event("auth:refresh-context"));
    setConflict(null);
  };

  return { conflict, notify, dismiss, refreshContext };
}
