import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  AVAILABILITY_PRECISION,
  DisputeImpactCalculator,
  calculateDisputeImpact,
  formatAvailability,
} from "@/components/admin/DisputeImpactCalculator";

/** 30 days, the usual SLA month. */
const MONTH = 30 * 24 * 60;

const input = (overrides: Partial<Parameters<typeof calculateDisputeImpact>[0]> = {}) => ({
  periodMinutes: MONTH,
  currentDowntimeMinutes: 60,
  disputedDowntimeMinutes: 30,
  targetAvailability: 99.9,
  ...overrides,
});

/**
 * Issue #642 — SLA impact calculator.
 *
 * The issue asks specifically for the math to be tested, so most of this exercises
 * `calculateDisputeImpact` directly; the panel is a projection of it.
 */
describe("calculateDisputeImpact", () => {
  it("computes availability from period and downtime", () => {
    const result = calculateDisputeImpact(
      input({ currentDowntimeMinutes: 0, disputedDowntimeMinutes: 0 }),
    );

    expect(result.currentAvailability).toBe(100);
    expect(result.proposedAvailability).toBe(100);
    expect(result.deltaPercentagePoints).toBe(0);
  });

  it("reproduces the worked example from the issue", () => {
    // 99.85% → 99.92% over a 30-day month is ~65 minutes down, ~31 disputed.
    const result = calculateDisputeImpact(
      input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 31 }),
    );

    expect(result.currentAvailability).toBe(99.85);
    expect(result.proposedAvailability).toBe(99.92);
    expect(result.deltaPercentagePoints).toBe(0.07);
  });

  it("raises availability by the disputed proportion", () => {
    const result = calculateDisputeImpact(
      input({ currentDowntimeMinutes: 432, disputedDowntimeMinutes: 432 }),
    );

    // 432 of 43,200 minutes is exactly 1%.
    expect(result.currentAvailability).toBe(99);
    expect(result.proposedAvailability).toBe(100);
    expect(result.deltaPercentagePoints).toBe(1);
  });

  it("never lowers availability", () => {
    const result = calculateDisputeImpact(input());

    expect(result.proposedAvailability).toBeGreaterThanOrEqual(
      result.currentAvailability,
    );
    expect(result.deltaPercentagePoints).toBeGreaterThanOrEqual(0);
  });

  it("reports a delta that matches the two figures shown", () => {
    const result = calculateDisputeImpact(
      input({ currentDowntimeMinutes: 123, disputedDowntimeMinutes: 47 }),
    );

    // The delta is computed from the rounded figures, so the arithmetic on screen
    // always adds up. Computing it from the raw values would show 99.72 → 99.83
    // with a delta of 0.12.
    expect(result.deltaPercentagePoints).toBe(
      Number(
        (result.proposedAvailability - result.currentAvailability).toFixed(
          AVAILABILITY_PRECISION,
        ),
      ),
    );
  });

  describe("clamping", () => {
    it("caps disputed minutes at the downtime actually recorded", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 60, disputedDowntimeMinutes: 500 }),
      );

      // Allowing more would push availability above 100%, which reads as a bug.
      expect(result.appliedDisputedMinutes).toBe(60);
      expect(result.proposedAvailability).toBe(100);
    });

    it("reports how many minutes it actually used", () => {
      const generous = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 60, disputedDowntimeMinutes: 500 }),
      );
      const exact = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 60, disputedDowntimeMinutes: 30 }),
      );

      // So a caller can tell "clamped" from "accepted as given".
      expect(generous.appliedDisputedMinutes).toBe(60);
      expect(exact.appliedDisputedMinutes).toBe(30);
    });

    it("treats negative downtime as zero", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: -10, disputedDowntimeMinutes: -5 }),
      );

      expect(result.currentAvailability).toBe(100);
      expect(result.appliedDisputedMinutes).toBe(0);
    });

    it("caps downtime at the length of the period", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: MONTH * 2, disputedDowntimeMinutes: 0 }),
      );

      // Availability must not go negative.
      expect(result.currentAvailability).toBe(0);
    });
  });

  describe("penalty eligibility", () => {
    it("is eligible below the target", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 100, disputedDowntimeMinutes: 0 }),
      );

      expect(result.currentAvailability).toBeLessThan(99.9);
      expect(result.currentlyPenaltyEligible).toBe(true);
    });

    it("is not eligible exactly on target", () => {
      const result = calculateDisputeImpact(
        input({
          periodMinutes: 1000,
          currentDowntimeMinutes: 1,
          disputedDowntimeMinutes: 0,
          targetAvailability: 99.9,
        }),
      );

      // Meeting the commitment is not breaching it; a strict comparison would
      // make every on-target month a penalty month.
      expect(result.currentAvailability).toBe(99.9);
      expect(result.currentlyPenaltyEligible).toBe(false);
    });

    it("flags an outcome that removes eligibility", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 40 }),
      );

      expect(result.currentlyPenaltyEligible).toBe(true);
      expect(result.proposedPenaltyEligible).toBe(false);
      expect(result.penaltyEligibilityChanges).toBe(true);
    });

    it("does not flag a change when the outage stays eligible", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 500, disputedDowntimeMinutes: 10 }),
      );

      expect(result.currentlyPenaltyEligible).toBe(true);
      expect(result.proposedPenaltyEligible).toBe(true);
      expect(result.penaltyEligibilityChanges).toBe(false);
    });

    it("does not flag a change when the outage was never eligible", () => {
      const result = calculateDisputeImpact(
        input({ currentDowntimeMinutes: 10, disputedDowntimeMinutes: 5 }),
      );

      expect(result.currentlyPenaltyEligible).toBe(false);
      expect(result.penaltyEligibilityChanges).toBe(false);
    });
  });

  describe("invalid period", () => {
    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
      "refuses a period of %s",
      (periodMinutes) => {
        // Dividing by this would render as "NaN%" or "Infinity%".
        expect(() =>
          calculateDisputeImpact(input({ periodMinutes })),
        ).toThrow(/positive number/i);
      },
    );
  });
});

describe("formatAvailability", () => {
  it("always shows the same precision", () => {
    expect(formatAvailability(100)).toBe("100.00%");
    expect(formatAvailability(99.9)).toBe("99.90%");
    expect(formatAvailability(99.857)).toBe("99.86%");
  });
});

describe("DisputeImpactCalculator", () => {
  it("shows both figures side by side", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 31 })}
      />,
    );

    expect(screen.getByText("Current availability")).toBeInTheDocument();
    expect(screen.getByText("If upheld")).toBeInTheDocument();
    expect(screen.getAllByText("99.85%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("99.92%").length).toBeGreaterThan(0);
  });

  it("shows the delta", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 31 })}
      />,
    );

    expect(screen.getByText(/\+0\.07 percentage points/)).toBeInTheDocument();
  });

  it("highlights the loss of penalty eligibility", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 40 })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /would remove penalty eligibility/i,
    );
  });

  it("says so when eligibility does not change", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 10, disputedDowntimeMinutes: 5 })}
      />,
    );

    expect(
      screen.getByText(/stays within SLA either way/i),
    ).toBeInTheDocument();
  });

  it("labels each figure with its eligibility", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 65, disputedDowntimeMinutes: 40 })}
      />,
    );

    // Colour is not the only signal for whether a figure breaches the SLA.
    expect(screen.getByText("Penalty eligible")).toBeInTheDocument();
    expect(screen.getByText("Within SLA")).toBeInTheDocument();
  });

  it("mentions when the disputed duration was clamped", () => {
    render(
      <DisputeImpactCalculator
        {...input({ currentDowntimeMinutes: 60, disputedDowntimeMinutes: 900 })}
      />,
    );

    expect(
      screen.getByText(/exceeds the downtime recorded/i),
    ).toBeInTheDocument();
  });

  it("reports an invalid period instead of rendering NaN", () => {
    render(<DisputeImpactCalculator {...input({ periodMinutes: 0 })} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /SLA period is missing or invalid/i,
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
