/**
 * Dispute resolution SLA helpers.
 *
 * Disputes must be resolved within a fixed 14-day window before automatic
 * escalation occurs. These helpers compute the remaining time so the UI can
 * surface urgency without relying on the backend.
 */

export const DISPUTE_RESOLUTION_SLA_DAYS = 14;
export const URGENT_REMAINING_HOURS = 48;

export type DeadlineState =
  | { kind: "overdue"; remainingMs: number }
  | { kind: "urgent"; remainingMs: number }
  | { kind: "ok"; remainingMs: number }
  | { kind: "settled" };

/**
 * Compute how much time remains before a dispute's resolution deadline,
 * measured from `createdAt`.
 *
 * - `overdue`: deadline has passed (escalation window reached)
 * - `urgent`: fewer than `URGENT_REMAINING_HOURS` left (amber highlight)
 * - `ok`: more than `URGENT_REMAINING_HOURS` left
 * - `settled`: the dispute already has a terminal status
 */
export function getDisputeDeadlineState(
  createdAt: string | Date,
  status: string,
  now: Date = new Date(),
): DeadlineState {
  const isSettled = status === "resolved" || status === "rejected";
  if (isSettled) {
    return { kind: "settled" };
  }

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return { kind: "ok", remainingMs: Number.POSITIVE_INFINITY };
  }

  const deadline = new Date(
    created.getTime() + DISPUTE_RESOLUTION_SLA_DAYS * 24 * 60 * 60 * 1000,
  );
  const remainingMs = deadline.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return { kind: "overdue", remainingMs };
  }

  const remainingHours = remainingMs / (60 * 60 * 1000);
  if (remainingHours < URGENT_REMAINING_HOURS) {
    return { kind: "urgent", remainingMs };
  }

  return { kind: "ok", remainingMs };
}

/** Format a millisecond duration as a compact "3d 4h" / "5h 12m" label. */
export function formatRemainingTime(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "0h";
  }

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
