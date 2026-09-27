/**
 * Dispute escalation rules (opsoll/noc-iq-fe#496).
 *
 * Unresolved disputes exceeding 7 days need formal escalation to senior
 * management. These helpers decide when the 'Escalate Dispute' action is
 * available and which priorities the escalation modal offers.
 */

import type { EscalationPriority, SLADispute } from '@/types/sla';

export const ESCALATION_THRESHOLD_DAYS = 7;

export const ESCALATION_PRIORITIES: EscalationPriority[] = [
  'low',
  'normal',
  'high',
  'critical',
];

export const ESCALATION_PRIORITY_LABELS: Record<EscalationPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

/** Pending statuses a dispute can still be escalated from. */
const ESCALATABLE_STATUSES: ReadonlyArray<SLADispute['status']> = [
  'open',
  'under_review',
];

/**
 * A dispute is escalatable when it is still pending (open / under_review)
 * and older than the 7-day escalation threshold.
 */
export function isEscalatable(
  dispute: Pick<SLADispute, 'created_at' | 'status'>,
  now: Date = new Date()
): boolean {
  if (!ESCALATABLE_STATUSES.includes(dispute.status)) {
    return false;
  }

  const created = new Date(dispute.created_at);
  if (Number.isNaN(created.getTime())) {
    return false;
  }

  const ageMs = now.getTime() - created.getTime();
  return ageMs >= ESCALATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}
