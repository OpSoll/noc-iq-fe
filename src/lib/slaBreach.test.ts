import { describe, it, expect } from "vitest";
import {
  BREACH_WARNING_MINUTES,
  buildBreachCountdowns,
  computeMinutesRemaining,
  formatCountdown,
} from "./slaBreach";
import type { Outage } from "@/types/outages";

const NOW = new Date("2026-08-28T12:00:00Z");

function makeOutage(overrides: Partial<Outage>): Outage {
  return {
    id: overrides.id ?? "o1",
    site_name: overrides.site_name ?? "Site A",
    severity: overrides.severity ?? "critical",
    status: overrides.status ?? "open",
    detected_at: overrides.detected_at ?? NOW.toISOString(),
    description: "test",
    affected_services: [],
    ...overrides,
  };
}

describe("computeMinutesRemaining", () => {
  it("returns the full threshold when just detected", () => {
    expect(computeMinutesRemaining(NOW.toISOString(), 30, NOW)).toBeCloseTo(30, 5);
  });

  it("counts down as time elapses", () => {
    const detectedAt = new Date(NOW.getTime() - 10 * 60_000).toISOString();
    expect(computeMinutesRemaining(detectedAt, 30, NOW)).toBeCloseTo(20, 5);
  });

  it("goes negative once the threshold has passed", () => {
    const detectedAt = new Date(NOW.getTime() - 45 * 60_000).toISOString();
    expect(computeMinutesRemaining(detectedAt, 30, NOW)).toBeCloseTo(-15, 5);
  });

  it("returns NaN for invalid input", () => {
    expect(computeMinutesRemaining("not-a-date", 30, NOW)).toBeNaN();
  });
});

describe("buildBreachCountdowns", () => {
  const thresholds = {
    critical: { threshold_minutes: 30 },
    high: { threshold_minutes: 60 },
  };

  it("only includes open outages with a configured threshold", () => {
    const outages: Outage[] = [
      makeOutage({ id: "1", status: "open", severity: "critical" }),
      makeOutage({ id: "2", status: "resolved", severity: "critical" }),
      makeOutage({ id: "3", status: "open", severity: "low" }), // no threshold configured
    ];
    const countdowns = buildBreachCountdowns(outages, thresholds, NOW);
    expect(countdowns.map((c) => c.outageId)).toEqual(["1"]);
  });

  it("flags outages under the warning threshold", () => {
    const detectedAt = new Date(NOW.getTime() - 20 * 60_000).toISOString(); // 10m left of 30m
    const outages: Outage[] = [makeOutage({ id: "1", detected_at: detectedAt, severity: "critical" })];
    const [countdown] = buildBreachCountdowns(outages, thresholds, NOW);
    expect(countdown.minutesRemaining).toBeCloseTo(10, 5);
    expect(countdown.isWarning).toBe(true);
    expect(countdown.isBreached).toBe(false);
    expect(countdown.minutesRemaining).toBeLessThan(BREACH_WARNING_MINUTES);
  });

  it("flags already-breached outages", () => {
    const detectedAt = new Date(NOW.getTime() - 40 * 60_000).toISOString(); // over the 30m threshold
    const outages: Outage[] = [makeOutage({ id: "1", detected_at: detectedAt, severity: "critical" })];
    const [countdown] = buildBreachCountdowns(outages, thresholds, NOW);
    expect(countdown.isBreached).toBe(true);
    expect(countdown.isWarning).toBe(false);
  });

  it("sorts soonest-to-breach first", () => {
    const outages: Outage[] = [
      makeOutage({ id: "far", detected_at: new Date(NOW.getTime() - 5 * 60_000).toISOString(), severity: "critical" }), // 25m left
      makeOutage({ id: "near", detected_at: new Date(NOW.getTime() - 25 * 60_000).toISOString(), severity: "critical" }), // 5m left
      makeOutage({ id: "breached", detected_at: new Date(NOW.getTime() - 35 * 60_000).toISOString(), severity: "critical" }), // -5m
    ];
    const countdowns = buildBreachCountdowns(outages, thresholds, NOW);
    expect(countdowns.map((c) => c.outageId)).toEqual(["breached", "near", "far"]);
  });
});

describe("formatCountdown", () => {
  it("formats remaining time as MMm SSs", () => {
    expect(formatCountdown(10.5)).toBe("10m 30s");
    expect(formatCountdown(0.5)).toBe("0m 30s");
  });

  it("formats breached outages as overdue", () => {
    expect(formatCountdown(-5)).toBe("Breached 5m ago");
    expect(formatCountdown(0)).toBe("Breached 0m ago");
  });

  it("returns a placeholder for invalid input", () => {
    expect(formatCountdown(NaN)).toBe("—");
  });
});
