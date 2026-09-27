"use client";

import { ArrowRight, MinusCircle, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Decimal places availability is reported to. Matches the issue's 99.85% form. */
export const AVAILABILITY_PRECISION = 2;

export interface SLAImpactInput {
  /** Total minutes in the SLA measurement period. */
  periodMinutes: number;
  /** Downtime minutes currently counted against the SLA. */
  currentDowntimeMinutes: number;
  /** Downtime minutes the dispute asks to be excluded. */
  disputedDowntimeMinutes: number;
  /** Availability the SLA commits to, as a percentage — e.g. 99.9. */
  targetAvailability: number;
}

export interface SLAImpactResult {
  /** Availability as things stand. */
  currentAvailability: number;
  /** Availability if the dispute is upheld. */
  proposedAvailability: number;
  /** Change in percentage points. Positive means availability improves. */
  deltaPercentagePoints: number;
  /** Disputed minutes actually applied, after clamping. */
  appliedDisputedMinutes: number;
  currentlyPenaltyEligible: boolean;
  proposedPenaltyEligible: boolean;
  /** True when upholding the dispute moves the outage across the threshold. */
  penaltyEligibilityChanges: boolean;
}

function round(value: number, places = AVAILABILITY_PRECISION): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Projects the SLA availability impact of upholding a dispute (issue #642).
 *
 * ```
 * availability = (period - downtime) / period × 100
 * ```
 *
 * Upholding a dispute excludes the disputed minutes from the counted downtime, so
 * availability can only rise or stay level — never fall.
 *
 * ## Clamping, and why it is not silent
 *
 * The disputed minutes are clamped to the downtime actually counted: a dispute
 * cannot remove more outage than the SLA recorded, and letting it would produce
 * an availability above 100%, which reads as a calculation bug rather than as bad
 * input. `appliedDisputedMinutes` reports what was used, so a caller can tell the
 * difference between "nothing was clamped" and "your input was too large".
 *
 * Negative inputs are clamped to zero for the same reason.
 *
 * ## Penalty eligibility
 *
 * Eligible means availability is *below* the committed target. Exactly meeting the
 * target is not a breach — 99.9% against a 99.9% commitment is met, not missed —
 * because a strict comparison would make every on-target month a penalty month.
 *
 * @param input - Period, downtime, disputed minutes and the committed target.
 * @returns Before and after availability, the delta and eligibility either side.
 * @throws When `periodMinutes` is not a positive, finite number.
 */
export function calculateDisputeImpact(input: SLAImpactInput): SLAImpactResult {
  const { periodMinutes, targetAvailability } = input;

  if (!Number.isFinite(periodMinutes) || periodMinutes <= 0) {
    // Dividing by this would yield Infinity or NaN and render as "NaN%".
    throw new Error("periodMinutes must be a positive number.");
  }

  const countedDowntime = Math.min(
    Math.max(input.currentDowntimeMinutes, 0),
    periodMinutes,
  );
  const appliedDisputedMinutes = Math.min(
    Math.max(input.disputedDowntimeMinutes, 0),
    countedDowntime,
  );

  const currentAvailability = round(
    ((periodMinutes - countedDowntime) / periodMinutes) * 100,
  );
  const proposedAvailability = round(
    ((periodMinutes - (countedDowntime - appliedDisputedMinutes)) /
      periodMinutes) *
      100,
  );

  const currentlyPenaltyEligible = currentAvailability < targetAvailability;
  const proposedPenaltyEligible = proposedAvailability < targetAvailability;

  return {
    currentAvailability,
    proposedAvailability,
    // Rounded from the rounded figures on purpose: the delta shown must be the
    // difference between the two numbers on screen, or it looks like an error.
    deltaPercentagePoints: round(proposedAvailability - currentAvailability),
    appliedDisputedMinutes,
    currentlyPenaltyEligible,
    proposedPenaltyEligible,
    penaltyEligibilityChanges:
      currentlyPenaltyEligible !== proposedPenaltyEligible,
  };
}

/**
 * Formats an availability percentage for display.
 *
 * @param value - Percentage.
 * @returns Fixed-precision string with a percent sign.
 */
export function formatAvailability(value: number): string {
  return `${value.toFixed(AVAILABILITY_PRECISION)}%`;
}

function Figure({
  label,
  value,
  eligible,
  emphasis,
}: {
  label: string;
  value: number;
  eligible: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex-1 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          emphasis && "text-primary",
        )}
      >
        {formatAvailability(value)}
      </p>
      <p
        className={cn(
          "mt-1 text-xs",
          eligible ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {eligible ? "Penalty eligible" : "Within SLA"}
      </p>
    </div>
  );
}

export interface DisputeImpactCalculatorProps extends SLAImpactInput {
  className?: string;
}

/**
 * SLA impact calculator for a dispute (issue #642).
 *
 * Shows availability as it stands beside availability if the dispute is upheld, the
 * delta between them, and whether the outcome moves the outage across the penalty
 * threshold.
 *
 * @param props - The same inputs as {@link calculateDisputeImpact}.
 * @returns The side-by-side comparison panel.
 */
export function DisputeImpactCalculator({
  className,
  ...input
}: DisputeImpactCalculatorProps) {
  let impact: SLAImpactResult;

  try {
    impact = calculateDisputeImpact(input);
  } catch {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>SLA impact</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-destructive">
            Cannot project the impact: the SLA period is missing or invalid.
          </p>
        </CardContent>
      </Card>
    );
  }

  const improves = impact.deltaPercentagePoints > 0;
  const clamped =
    impact.appliedDisputedMinutes < Math.max(input.disputedDowntimeMinutes, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>SLA impact if upheld</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-stretch gap-3">
          <Figure
            label="Current availability"
            value={impact.currentAvailability}
            eligible={impact.currentlyPenaltyEligible}
          />
          <div className="flex items-center" aria-hidden="true">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <Figure
            label="If upheld"
            value={impact.proposedAvailability}
            eligible={impact.proposedPenaltyEligible}
            emphasis
          />
        </div>

        <p className="flex items-center gap-2 text-sm">
          {improves ? (
            <TrendingUp
              className="h-4 w-4 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
          ) : (
            <MinusCircle
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span>
            {formatAvailability(impact.currentAvailability)} →{" "}
            {formatAvailability(impact.proposedAvailability)}{" "}
            <span className="text-muted-foreground">
              ({improves ? "+" : ""}
              {impact.deltaPercentagePoints.toFixed(AVAILABILITY_PRECISION)}{" "}
              percentage points)
            </span>
          </span>
        </p>

        {impact.penaltyEligibilityChanges && (
          <p
            role="status"
            className={cn(
              "rounded-md border p-3 text-sm font-medium",
              impact.proposedPenaltyEligible
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400",
            )}
          >
            {impact.proposedPenaltyEligible
              ? "Upholding this dispute would make the outage penalty eligible."
              : "Upholding this dispute would remove penalty eligibility."}
          </p>
        )}

        {!impact.penaltyEligibilityChanges && (
          <p className="text-sm text-muted-foreground">
            Penalty eligibility is unchanged
            {impact.currentlyPenaltyEligible
              ? " — the outage remains penalty eligible either way."
              : " — the outage stays within SLA either way."}
          </p>
        )}

        {clamped && (
          <p className="text-xs text-muted-foreground">
            The disputed duration exceeds the downtime recorded against this SLA,
            so {impact.appliedDisputedMinutes} minute
            {impact.appliedDisputedMinutes === 1 ? "" : "s"} were applied.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Target availability {formatAvailability(input.targetAvailability)} over{" "}
          {input.periodMinutes.toLocaleString()} minutes.
        </p>
      </CardContent>
    </Card>
  );
}

export default DisputeImpactCalculator;
