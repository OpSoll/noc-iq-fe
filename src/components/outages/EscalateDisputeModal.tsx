"use client";

/**
 * Dispute escalation prompt (opsoll/noc-iq-fe#496).
 *
 * Collects an escalation priority and the senior manager tag the dispute is
 * being routed to, then escalates via the SLA disputes service.
 */

import { useState } from "react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  ESCALATION_PRIORITIES,
  ESCALATION_PRIORITY_LABELS,
} from "./disputeEscalation";
import { escalateDispute } from "@/services/sla";
import type { EscalationPriority, SLADispute } from "@/types/sla";

interface EscalateDisputeModalProps {
  dispute: SLADispute | null;
  onClose: () => void;
  onEscalated: (dispute: SLADispute) => void;
}

export default function EscalateDisputeModal({
  dispute,
  onClose,
  onEscalated,
}: EscalateDisputeModalProps) {
  const [priority, setPriority] = useState<EscalationPriority>("high");
  const [managerTag, setManagerTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!dispute) return null;

  const handleSubmit = async () => {
    setError(null);

    if (!managerTag.trim()) {
      setError("A manager tag is required.");
      return;
    }

    setSubmitting(true);
    try {
      const escalated = await escalateDispute(dispute.id, {
        priority,
        manager_tag: managerTag.trim(),
      });
      onEscalated(escalated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Escalation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(dispute)}
      onClose={submitting ? () => undefined : onClose}
      title="Escalate dispute to senior management"
      maxWidth="max-w-md"
      disableBackdropClose={submitting}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This dispute has been pending for more than{" "}
          <strong>7 days</strong>. Escalation routes it to senior management
          for formal review.
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="escalation-priority"
            className="text-sm font-medium text-slate-700"
          >
            Escalation priority
          </label>
          <select
            id="escalation-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as EscalationPriority)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          >
            {ESCALATION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {ESCALATION_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="escalation-manager"
            className="text-sm font-medium text-slate-700"
          >
            Manager tag
          </label>
          <input
            id="escalation-manager"
            value={managerTag}
            onChange={(e) => {
              setManagerTag(e.target.value);
              setError(null);
            }}
            placeholder="@senior-manager or manager email..."
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            maxLength={120}
          />
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" type="submit" disabled={submitting}>
            {submitting ? "Escalating..." : "Escalate dispute"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
