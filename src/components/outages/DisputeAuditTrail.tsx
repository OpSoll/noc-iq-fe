"use client";

import { memo } from "react";

import type { SLADispute } from "@/types/sla";

interface AuditEvent {
  timestamp: string;
  actor: string;
  action: string;
  detail?: string;
}

/**
 * Builds a chronological audit trail from a dispute's own lifecycle
 * fields (flag -> resolution). There's no separate audit log endpoint
 * yet, so this reconstructs the trail from data the dispute record
 * already carries.
 */
function buildAuditTrail(dispute: SLADispute): AuditEvent[] {
  const events: AuditEvent[] = [
    {
      timestamp: dispute.created_at,
      actor: "Operator",
      action: "Flagged dispute",
      detail: dispute.reason,
    },
  ];

  if (dispute.resolved_at) {
    events.push({
      timestamp: dispute.resolved_at,
      actor: dispute.resolved_by ?? "Admin",
      action:
        dispute.status === "rejected" ? "Rejected dispute" : "Resolved dispute",
      detail: dispute.resolution_note ?? undefined,
    });
  }

  return events;
}

interface Props {
  dispute: SLADispute;
}

/**
 * Chronological audit log stream for a single dispute: timestamp, actor,
 * and action taken for each lifecycle event, including the resolution
 * note where available.
 */
function DisputeAuditTrail({ dispute }: Props) {
  const events = buildAuditTrail(dispute);

  return (
    <div className="space-y-2 border-l-2 border-slate-200 pl-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Audit Log
      </p>

      <ol className="space-y-2">
        {events.map((event, index) => (
          <li key={`${event.timestamp}-${index}`} className="text-xs text-slate-600">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-slate-700">{event.action}</span>
              <span className="text-slate-400">
                {new Date(event.timestamp).toLocaleString()}
              </span>
              <span className="text-slate-400">by {event.actor}</span>
            </div>
            {event.detail ? (
              <p className="mt-0.5 text-slate-500">{event.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default memo(DisputeAuditTrail);
