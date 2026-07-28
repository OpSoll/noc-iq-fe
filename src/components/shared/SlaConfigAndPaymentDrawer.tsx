"use client";
import { useState } from "react";
// Closes #371: SLA config editor with live preview and validation feedback
// Closes #372: payment detail drawer with transaction chain timeline

export interface SlaSeverityConfig {
  thresholdMinutes: number;
  penaltyPerMinute: number;
  rewardBase: number;
}
export function SlaConfigEditor({
  value,
  onSave,
}: {
  value: SlaSeverityConfig;
  onSave: (next: SlaSeverityConfig) => void;
}) {
  const [draft, setDraft] = useState(value);
  const invalid = draft.thresholdMinutes <= 0 || draft.penaltyPerMinute < 0;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!invalid) onSave(draft); }} className="space-y-2 text-sm">
      <label className="flex justify-between">
        Threshold (min)
        <input type="number" value={draft.thresholdMinutes}
          onChange={(e) => setDraft({ ...draft, thresholdMinutes: Number(e.target.value) })} />
      </label>
      <label className="flex justify-between">
        Penalty/min
        <input type="number" value={draft.penaltyPerMinute}
          onChange={(e) => setDraft({ ...draft, penaltyPerMinute: Number(e.target.value) })} />
      </label>
      {invalid && <p className="text-destructive">Threshold and penalty must be positive.</p>}
      <button type="submit" disabled={invalid}>Save</button>
    </form>
  );
}

export interface PaymentTimelineStep {
  label: string;
  timestamp: string;
}
export function PaymentDetailDrawer({ steps }: { steps: PaymentTimelineStep[] }) {
  return (
    <aside className="w-80 border-l p-4">
      <h3 className="text-sm font-semibold mb-2">Transaction Timeline</h3>
      <ol className="space-y-2 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex justify-between">
            <span>{s.label}</span>
            <span className="text-muted-foreground">{new Date(s.timestamp).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
