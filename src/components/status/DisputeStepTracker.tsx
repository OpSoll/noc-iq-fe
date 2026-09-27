"use client";

import { Check, Gavel, Scale, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DisputeStatus, SLADispute } from "@/types/sla";

/** Stages of the dispute lifecycle, in order. */
export const DISPUTE_STAGES = [
  "filed",
  "under_review",
  "arbitration",
  "resolved",
] as const;

export type DisputeStage = (typeof DISPUTE_STAGES)[number];

export type StageState = "complete" | "active" | "upcoming";

/** How a resolved dispute ended. */
export type DisputeOutcome = "upheld" | "dismissed" | null;

export interface DisputeStep {
  stage: DisputeStage;
  label: string;
  state: StageState;
  /** ISO timestamp shown under a completed step, when one is known. */
  timestamp?: string | null;
}

const STAGE_LABEL: Record<DisputeStage, string> = {
  filed: "Filed",
  under_review: "Under Review",
  arbitration: "Arbitration",
  resolved: "Resolved",
};

/**
 * How far through the lifecycle each backend status sits.
 *
 * `arbitration` has no backend status of its own — `DisputeStatus` is
 * `open | under_review | resolved | rejected`. A dispute that has finished is
 * therefore treated as having passed through arbitration, and a dispute still
 * under review has not reached it. The stage is shown because the issue asks for
 * it and because it is a real step in the process; it just cannot be observed
 * independently until the backend models it.
 */
const STATUS_INDEX: Record<DisputeStatus, number> = {
  open: 0,
  under_review: 1,
  resolved: 3,
  rejected: 3,
};

/**
 * Reads the outcome of a dispute, or null while it is still in progress.
 *
 * @param status - Backend dispute status.
 * @returns `upheld` for resolved, `dismissed` for rejected, null otherwise.
 */
export function disputeOutcome(status: DisputeStatus): DisputeOutcome {
  if (status === "resolved") return "upheld";
  if (status === "rejected") return "dismissed";
  return null;
}

/**
 * Derives the tracker steps from a dispute (issue #639).
 *
 * Exported and pure so the mapping can be tested without rendering, which is
 * where the interesting behaviour lives — the markup is a projection of this.
 *
 * @param dispute - The dispute to describe.
 * @returns One step per stage, in lifecycle order.
 */
export function buildDisputeSteps(
  dispute: Pick<SLADispute, "status" | "created_at" | "resolved_at">,
): DisputeStep[] {
  const reached = STATUS_INDEX[dispute.status];

  return DISPUTE_STAGES.map((stage, index) => {
    const state: StageState =
      index < reached ? "complete" : index === reached ? "active" : "upcoming";

    // Only two timestamps exist in the contract: when it was filed and when it
    // was resolved. Inventing one for the middle stages would be a guess
    // presented as a fact, so those are left blank.
    const timestamp =
      stage === "filed"
        ? dispute.created_at
        : stage === "resolved"
          ? (dispute.resolved_at ?? null)
          : null;

    return { stage, label: STAGE_LABEL[stage], state, timestamp };
  });
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StepIcon({
  step,
  outcome,
}: {
  step: DisputeStep;
  outcome: DisputeOutcome;
}) {
  const isFinalResolved = step.stage === "resolved" && step.state === "active";

  if (isFinalResolved && outcome === "dismissed") {
    return <X className="h-4 w-4" aria-hidden="true" />;
  }
  if (isFinalResolved && outcome === "upheld") {
    return <Check className="h-4 w-4" aria-hidden="true" />;
  }
  if (step.state === "complete") {
    return <Check className="h-4 w-4" aria-hidden="true" />;
  }
  if (step.stage === "arbitration") {
    return <Gavel className="h-4 w-4" aria-hidden="true" />;
  }
  if (step.stage === "under_review") {
    return <Scale className="h-4 w-4" aria-hidden="true" />;
  }
  return <span className="text-xs font-semibold">1</span>;
}

export interface DisputeStepTrackerProps {
  dispute: Pick<SLADispute, "status" | "created_at" | "resolved_at">;
  className?: string;
}

/**
 * Horizontal dispute lifecycle tracker (issue #639).
 *
 * Replaces the raw JSON dump of the status history with Filed → Under Review →
 * Arbitration → Resolved, the active stage highlighted and timestamps under the
 * steps that have them.
 *
 * Outcome colour follows the issue: green when the dispute was upheld, red when
 * dismissed. Colour is never the only signal — the resolved step also changes its
 * icon and its visible label — because a red-green distinction is invisible to the
 * most common form of colour blindness, and this is the one thing on the component
 * a user actually needs to read.
 *
 * @param props - The dispute to render.
 * @returns An ordered list of lifecycle steps.
 */
export function DisputeStepTracker({
  dispute,
  className,
}: DisputeStepTrackerProps) {
  const steps = buildDisputeSteps(dispute);
  const outcome = disputeOutcome(dispute.status);

  const outcomeLabel =
    outcome === "upheld"
      ? "Upheld — SLA breach confirmed"
      : outcome === "dismissed"
        ? "Dismissed — no breach found"
        : null;

  return (
    <div className={cn("space-y-3", className)}>
      <ol
        aria-label="Dispute progress"
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0"
      >
        {steps.map((step, index) => {
          const isResolvedStep = step.stage === "resolved";
          const isFinal = isResolvedStep && step.state === "active";

          const tone = isFinal
            ? outcome === "dismissed"
              ? "border-destructive bg-destructive text-destructive-foreground"
              : "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500"
            : step.state === "complete"
              ? "border-primary bg-primary text-primary-foreground"
              : step.state === "active"
                ? "border-primary bg-background text-primary"
                : "border-border bg-background text-muted-foreground";

          return (
            <li
              key={step.stage}
              aria-current={step.state === "active" ? "step" : undefined}
              className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
            >
              <div className="flex items-center sm:w-full">
                {/* Connector to the previous step, hidden on the first. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden h-0.5 flex-1 sm:block",
                    index === 0 && "invisible",
                    step.state === "upcoming" ? "bg-border" : "bg-primary",
                  )}
                />
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    tone,
                  )}
                >
                  <StepIcon step={step} outcome={outcome} />
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "hidden h-0.5 flex-1 sm:block",
                    index === steps.length - 1 && "invisible",
                    steps[index + 1]?.state === "upcoming"
                      ? "bg-border"
                      : "bg-primary",
                  )}
                />
              </div>

              <div className="sm:mt-2">
                <p
                  className={cn(
                    "text-sm",
                    step.state === "upcoming"
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {step.label}
                  {step.state === "active" && (
                    <span className="sr-only"> (current stage)</span>
                  )}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={step.timestamp}>
                      {formatTimestamp(step.timestamp)}
                    </time>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {outcomeLabel && (
        <p
          className={cn(
            "text-sm font-medium",
            outcome === "upheld"
              ? "text-green-700 dark:text-green-400"
              : "text-destructive",
          )}
        >
          {outcomeLabel}
        </p>
      )}
    </div>
  );
}

export default DisputeStepTracker;
