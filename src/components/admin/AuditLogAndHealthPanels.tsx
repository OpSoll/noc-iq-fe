"use client";
import { useState } from "react";
// Closes #201: admin audit-log viewer route
// Closes #202: operational metrics and health admin surface

export interface AuditEntry {
  id: string;
  category: "auth" | "payment" | "outage";
  message: string;
  occurredAt: string;
}

export function AuditLogViewer({ entries, isAuthorized }: { entries: AuditEntry[]; isAuthorized: boolean }) {
  const [category, setCategory] = useState<AuditEntry["category"] | "all">("all");
  if (!isAuthorized) return <p className="text-sm text-muted-foreground">Not authorized to view audit logs.</p>;

  const visible = entries.filter((e) => category === "all" || e.category === category);
  return (
    <div className="text-sm">
      <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mb-2">
        <option value="all">All</option>
        <option value="auth">Auth</option>
        <option value="payment">Payment</option>
        <option value="outage">Outage</option>
      </select>
      <ul className="space-y-1">
        {visible.map((e) => (
          <li key={e.id}>{e.occurredAt}: {e.message}</li>
        ))}
      </ul>
    </div>
  );
}

export interface HealthSnapshot {
  liveness: "ok" | "down";
  readiness: "ok" | "down";
  metrics?: Record<string, number>;
}

export function HealthMetricsPanel({ snapshot }: { snapshot: HealthSnapshot | null }) {
  if (!snapshot) return <p className="text-sm text-muted-foreground">Health data unavailable.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>Liveness: {snapshot.liveness}</div>
      <div>Readiness: {snapshot.readiness}</div>
      {snapshot.metrics &&
        Object.entries(snapshot.metrics).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
    </div>
  );
}
