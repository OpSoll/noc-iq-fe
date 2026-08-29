import type { Outage, Severity } from "@/types/outages";

// Closes #451: real-time SLA breach countdown for open outages

export interface SeverityThresholds {
  threshold_minutes: number;
}

export type SeverityThresholdMap = Partial<Record<Severity, SeverityThresholds>>;

export interface BreachCountdown {
  outageId: string;
  siteName: string;
  severity: Severity;
  detectedAt: string;
  thresholdMinutes: number;
  /** Minutes remaining until breach; negative once the SLA has been exceeded. */
  minutesRemaining: number;
  isBreached: boolean;
  /** True once minutesRemaining drops below the warning threshold but hasn't breached yet. */
  isWarning: boolean;
}

export const BREACH_WARNING_MINUTES = 15;

/**
 * Minutes remaining until an open outage breaches its severity's SLA threshold.
 * Negative once the deadline has passed.
 */
export function computeMinutesRemaining(
  detectedAt: string,
  thresholdMinutes: number,
  now: Date = new Date(),
): number {
  const detectedTime = new Date(detectedAt).getTime();
  if (Number.isNaN(detectedTime) || !Number.isFinite(thresholdMinutes)) return NaN;

  const elapsedMinutes = (now.getTime() - detectedTime) / 60_000;
  return thresholdMinutes - elapsedMinutes;
}

/**
 * Builds breach countdowns for open outages, using per-severity SLA thresholds.
 * Outages whose severity has no configured threshold are skipped.
 */
export function buildBreachCountdowns(
  outages: Outage[],
  thresholds: SeverityThresholdMap,
  now: Date = new Date(),
): BreachCountdown[] {
  const countdowns: BreachCountdown[] = [];

  for (const outage of outages) {
    if (outage.status !== "open") continue;

    const config = thresholds[outage.severity];
    if (!config) continue;

    const minutesRemaining = computeMinutesRemaining(
      outage.detected_at,
      config.threshold_minutes,
      now,
    );
    if (Number.isNaN(minutesRemaining)) continue;

    countdowns.push({
      outageId: outage.id,
      siteName: outage.site_name,
      severity: outage.severity,
      detectedAt: outage.detected_at,
      thresholdMinutes: config.threshold_minutes,
      minutesRemaining,
      isBreached: minutesRemaining <= 0,
      isWarning: minutesRemaining > 0 && minutesRemaining < BREACH_WARNING_MINUTES,
    });
  }

  // Soonest-to-breach first: already-breached outages sort ahead of the rest.
  return countdowns.sort((a, b) => a.minutesRemaining - b.minutesRemaining);
}

/** Formats a minutes-remaining value as `MMm SSs` (or `Breached Xm ago`). */
export function formatCountdown(minutesRemaining: number): string {
  if (!Number.isFinite(minutesRemaining)) return "—";

  if (minutesRemaining <= 0) {
    const overdueMinutes = Math.floor(Math.abs(minutesRemaining));
    return `Breached ${overdueMinutes}m ago`;
  }

  const totalSeconds = Math.floor(minutesRemaining * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
