import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  DISPUTE_STAGES,
  DisputeStepTracker,
  buildDisputeSteps,
  disputeOutcome,
} from "@/components/status/DisputeStepTracker";
import type { DisputeStatus, SLADispute } from "@/types/sla";

type Snapshot = Pick<SLADispute, "status" | "created_at" | "resolved_at">;

const FILED_AT = "2026-02-01T10:00:00Z";
const RESOLVED_AT = "2026-02-09T16:30:00Z";

const snapshot = (
  status: DisputeStatus,
  resolved_at: string | null = null,
): Snapshot => ({ status, created_at: FILED_AT, resolved_at });

const stateOf = (steps: ReturnType<typeof buildDisputeSteps>, stage: string) =>
  steps.find((step) => step.stage === stage)?.state;

/**
 * Issue #639 — dispute lifecycle tracker.
 *
 * The derivation is where the behaviour lives — the markup is a projection of it —
 * so most of these assert `buildDisputeSteps` directly.
 */
describe("buildDisputeSteps", () => {
  it("always returns the four stages in order", () => {
    const steps = buildDisputeSteps(snapshot("open"));

    expect(steps.map((step) => step.stage)).toEqual([...DISPUTE_STAGES]);
    expect(steps.map((step) => step.label)).toEqual([
      "Filed",
      "Under Review",
      "Arbitration",
      "Resolved",
    ]);
  });

  it("marks a newly filed dispute as active at Filed", () => {
    const steps = buildDisputeSteps(snapshot("open"));

    expect(stateOf(steps, "filed")).toBe("active");
    expect(stateOf(steps, "under_review")).toBe("upcoming");
    expect(stateOf(steps, "arbitration")).toBe("upcoming");
    expect(stateOf(steps, "resolved")).toBe("upcoming");
  });

  it("advances to Under Review", () => {
    const steps = buildDisputeSteps(snapshot("under_review"));

    expect(stateOf(steps, "filed")).toBe("complete");
    expect(stateOf(steps, "under_review")).toBe("active");
    expect(stateOf(steps, "arbitration")).toBe("upcoming");
  });

  it("treats a finished dispute as having passed through arbitration", () => {
    const steps = buildDisputeSteps(snapshot("resolved", RESOLVED_AT));

    // The backend has no distinct arbitration status, so a dispute that reached a
    // decision is taken to have gone through it.
    expect(stateOf(steps, "under_review")).toBe("complete");
    expect(stateOf(steps, "arbitration")).toBe("complete");
    expect(stateOf(steps, "resolved")).toBe("active");
  });

  it("puts a rejected dispute at the same stage as a resolved one", () => {
    expect(buildDisputeSteps(snapshot("rejected", RESOLVED_AT)).map((s) => s.state))
      .toEqual(buildDisputeSteps(snapshot("resolved", RESOLVED_AT)).map((s) => s.state));
  });

  it("carries the filed timestamp", () => {
    const steps = buildDisputeSteps(snapshot("open"));

    expect(steps[0].timestamp).toBe(FILED_AT);
  });

  it("carries the resolved timestamp once there is one", () => {
    const steps = buildDisputeSteps(snapshot("resolved", RESOLVED_AT));

    expect(steps[3].timestamp).toBe(RESOLVED_AT);
  });

  it("leaves the middle stages without timestamps", () => {
    const steps = buildDisputeSteps(snapshot("resolved", RESOLVED_AT));

    // Only two timestamps exist in the contract; inventing the others would be a
    // guess presented as a fact.
    expect(steps[1].timestamp).toBeNull();
    expect(steps[2].timestamp).toBeNull();
  });

  it("tolerates a resolved dispute with no resolution timestamp", () => {
    const steps = buildDisputeSteps(snapshot("resolved", null));

    expect(steps[3].state).toBe("active");
    expect(steps[3].timestamp).toBeNull();
  });
});

describe("disputeOutcome", () => {
  it("reads resolved as upheld and rejected as dismissed", () => {
    expect(disputeOutcome("resolved")).toBe("upheld");
    expect(disputeOutcome("rejected")).toBe("dismissed");
  });

  it("has no outcome while the dispute is in progress", () => {
    expect(disputeOutcome("open")).toBeNull();
    expect(disputeOutcome("under_review")).toBeNull();
  });
});

describe("DisputeStepTracker", () => {
  it("renders the four lifecycle steps as an ordered list", () => {
    render(<DisputeStepTracker dispute={snapshot("open")} />);

    expect(screen.getByRole("list", { name: "Dispute progress" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const label of ["Filed", "Under Review", "Arbitration", "Resolved"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the active stage for assistive tech", () => {
    render(<DisputeStepTracker dispute={snapshot("under_review")} />);

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "step");

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Under Review");
  });

  it("shows a timestamp under a step that has one", () => {
    render(<DisputeStepTracker dispute={snapshot("resolved", RESOLVED_AT)} />);

    const times = screen.getAllByText((_, element) => element?.tagName === "TIME");
    expect(times.length).toBeGreaterThanOrEqual(2);

    const dateTimes = times.map((element) => element.getAttribute("datetime"));
    expect(dateTimes).toContain(FILED_AT);
    expect(dateTimes).toContain(RESOLVED_AT);
  });

  it("states an upheld outcome in words, not only in colour", () => {
    render(<DisputeStepTracker dispute={snapshot("resolved", RESOLVED_AT)} />);

    // Red/green is invisible to the most common form of colour blindness, and
    // this is the one thing on the component a user needs to read.
    expect(screen.getByText(/Upheld — SLA breach confirmed/)).toBeInTheDocument();
  });

  it("states a dismissed outcome in words", () => {
    render(<DisputeStepTracker dispute={snapshot("rejected", RESOLVED_AT)} />);

    expect(screen.getByText(/Dismissed — no breach found/)).toBeInTheDocument();
  });

  it("uses green for upheld and red for dismissed", () => {
    const { container: upheld } = render(
      <DisputeStepTracker dispute={snapshot("resolved", RESOLVED_AT)} />,
    );
    expect(upheld.innerHTML).toContain("green");

    const { container: dismissed } = render(
      <DisputeStepTracker dispute={snapshot("rejected", RESOLVED_AT)} />,
    );
    expect(dismissed.innerHTML).toContain("destructive");
  });

  it("says nothing about an outcome while the dispute is open", () => {
    render(<DisputeStepTracker dispute={snapshot("under_review")} />);

    expect(screen.queryByText(/Upheld/)).toBeNull();
    expect(screen.queryByText(/Dismissed/)).toBeNull();
  });

  it("falls back to the raw value for an unparseable timestamp", () => {
    render(
      <DisputeStepTracker
        dispute={{ status: "open", created_at: "not-a-date", resolved_at: null }}
      />,
    );

    // Better a visibly odd string than "Invalid Date".
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });
});
