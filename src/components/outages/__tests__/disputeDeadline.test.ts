import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import DisputeDeadlineBadge from "../DisputeDeadlineBadge";
import {
  DISPUTE_RESOLUTION_SLA_DAYS,
  getDisputeDeadlineState,
  formatRemainingTime,
} from "../disputeDeadline";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const now = new Date("2026-08-31T12:00:00Z");

function createdAtDaysAgo(days: number): string {
  return new Date(now.getTime() - days * DAY).toISOString();
}

describe("getDisputeDeadlineState", () => {
  it("reports ok while well inside the SLA window", () => {
    const state = getDisputeDeadlineState(
      createdAtDaysAgo(1),
      "open",
      now,
    );
    expect(state.kind).toBe("ok");
  });

  it("reports urgent with fewer than 48 hours remaining", () => {
    const state = getDisputeDeadlineState(
      createdAtDaysAgo(DISPUTE_RESOLUTION_SLA_DAYS - 1),
      "under_review",
      now,
    );
    expect(state.kind).toBe("urgent");
  });

  it("reports overdue once the deadline has passed", () => {
    const state = getDisputeDeadlineState(
      createdAtDaysAgo(DISPUTE_RESOLUTION_SLA_DAYS + 1),
      "open",
      now,
    );
    expect(state.kind).toBe("overdue");
  });

  it("reports settled for terminal statuses", () => {
    for (const status of ["resolved", "rejected"]) {
      const state = getDisputeDeadlineState(createdAtDaysAgo(0), status, now);
      expect(state.kind).toBe("settled");
    }
  });
});

describe("formatRemainingTime", () => {
  it("formats days and hours", () => {
    expect(formatRemainingTime(3 * DAY + 4 * HOUR)).toBe("3d 4h");
  });

  it("formats hours and minutes", () => {
    expect(formatRemainingTime(5 * HOUR + 12 * 60 * 1000)).toBe("5h 12m");
  });

  it("formats minutes only", () => {
    expect(formatRemainingTime(45 * 60 * 1000)).toBe("45m");
  });

  it("handles non-positive durations", () => {
    expect(formatRemainingTime(0)).toBe("0h");
    expect(formatRemainingTime(-1000)).toBe("0h");
  });
});

describe("DisputeDeadlineBadge", () => {
  it("renders a countdown badge for an open dispute", () => {
    render(
      <DisputeDeadlineBadge
        createdAt={createdAtDaysAgo(1)}
        status="open"
        now={now}
      />,
    );
    expect(screen.getByText(/to deadline/)).toBeInTheDocument();
  });

  it("renders nothing for settled disputes", () => {
    const { container } = render(
      <DisputeDeadlineBadge
        createdAt={createdAtDaysAgo(1)}
        status="resolved"
        now={now}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("highlights urgent disputes in amber", () => {
    render(
      <DisputeDeadlineBadge
        createdAt={createdAtDaysAgo(DISPUTE_RESOLUTION_SLA_DAYS - 1)}
        status="open"
        now={now}
      />,
    );
    const badge = screen.getByText(/left/);
    expect(badge.className).toContain("amber");
  });

  it("shows Escalating for overdue disputes", () => {
    render(
      <DisputeDeadlineBadge
        createdAt={createdAtDaysAgo(DISPUTE_RESOLUTION_SLA_DAYS + 1)}
        status="open"
        now={now}
      />,
    );
    expect(screen.getByText("Escalating")).toBeInTheDocument();
  });
});
