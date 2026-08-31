"use client";

import { memo } from "react";

import { Badge } from "@/components/ui/badge";

import {
  getDisputeDeadlineState,
  formatRemainingTime,
  type DeadlineState,
} from "./disputeDeadline";

const DEADLINE_LABELS: Record<DeadlineState["kind"], string> = {
  overdue: "Escalating",
  urgent: "Resolve soon",
  ok: "In SLA window",
  settled: "Settled",
};

interface Props {
  createdAt: string;
  status: string;
  /** Injectable clock for tests. */
  now?: Date;
}

/**
 * Badge showing how much time remains before a dispute's 14-day resolution
 * deadline. Disputes with fewer than 48 hours remaining are highlighted in
 * amber; overdue disputes render in red.
 */
function DisputeDeadlineBadge({ createdAt, status, now }: Props) {
  const state = getDisputeDeadlineState(createdAt, status, now);

  if (state.kind === "settled") {
    return null;
  }

  const variant =
    state.kind === "overdue"
      ? "destructive"
      : state.kind === "urgent"
        ? "secondary"
        : "outline";

  const urgentClass =
    state.kind === "urgent"
      ? "!border-amber-400 !bg-amber-50 !text-amber-700"
      : "";

  const label =
    state.kind === "overdue"
      ? DEADLINE_LABELS.overdue
      : state.kind === "urgent"
        ? `${formatRemainingTime(state.remainingMs)} left`
        : `${formatRemainingTime(state.remainingMs)} to deadline`;

  return (
    <Badge variant={variant} className={`shrink-0 ${urgentClass}`} title={label}>
      {label}
    </Badge>
  );
}

export default memo(DisputeDeadlineBadge);
