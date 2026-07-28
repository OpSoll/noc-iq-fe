"use client";

import React, { useMemo, useState, useCallback } from "react";

export type TimelineEventType = "user_action" | "backend_response" | "error" | "webhook" | "payment" | "outage";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: TimelineEventType;
  label: string;
  detail: string;
  causalityId?: string;
  outageId?: string;
  paymentId?: string;
  webhookId?: string;
  severity?: "info" | "warning" | "error";
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
  outageId?: string;
  paymentId?: string;
  webhookId?: string;
}

const typeIcon: Record<TimelineEventType, string> = {
  user_action: "👤",
  backend_response: "⚙️",
  error: "❌",
  webhook: "🔔",
  payment: "💳",
  outage: "🔴",
};

const severityColor: Record<string, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  error: "border-red-300 bg-red-50 text-red-800",
};

function exportToJson(events: TimelineEvent[]): string {
  return JSON.stringify(events, null, 2);
}

function causalityChain(events: TimelineEvent[]): TimelineEvent[][] {
  const chains: TimelineEvent[][] = [];
  const visited = new Set<string>();

  for (const event of events) {
    if (visited.has(event.id)) continue;
    if (!event.causalityId) {
      chains.push([event]);
      visited.add(event.id);
      continue;
    }
    const chain: TimelineEvent[] = [event];
    visited.add(event.id);
    let current = event;
    while (current.causalityId) {
      const next = events.find((e) => e.id === current.causalityId);
      if (!next || visited.has(next.id)) break;
      chain.push(next);
      visited.add(next.id);
      current = next;
    }
    chains.push(chain);
  }

  return chains;
}

export default function IncidentTimeline({
  events,
  outageId,
  paymentId,
  webhookId,
}: IncidentTimelineProps) {
  const [filterType, setFilterType] = useState<TimelineEventType | "all">("all");

  const filteredEvents = useMemo(() => {
    let result = events;
    if (outageId) result = result.filter((e) => e.outageId === outageId);
    if (paymentId) result = result.filter((e) => e.paymentId === paymentId);
    if (webhookId) result = result.filter((e) => e.webhookId === webhookId);
    if (filterType !== "all") result = result.filter((e) => e.type === filterType);
    return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [events, filterType, outageId, paymentId, webhookId]);

  const chains = useMemo(() => causalityChain(filteredEvents), [filteredEvents]);

  const handleExport = useCallback(() => {
    const json = exportToJson(filteredEvents);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-timeline-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Incident Timeline</h2>
        <button
          onClick={handleExport}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Export JSON
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TimelineEventType | "all")}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="all">All types</option>
          <option value="user_action">User actions</option>
          <option value="backend_response">Backend responses</option>
          <option value="error">Errors</option>
          <option value="webhook">Webhooks</option>
          <option value="payment">Payments</option>
          <option value="outage">Outages</option>
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No events match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {chains.map((chain, chainIdx) => (
            <div key={chainIdx} className="relative">
              {chain.map((event, idx) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-lg">{typeIcon[event.type]}</span>
                    {idx < chain.length - 1 && (
                      <div className="mt-1 h-4 w-0.5 bg-gray-300" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-md border p-3 ${
                      severityColor[event.severity ?? "info"]
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{event.label}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
