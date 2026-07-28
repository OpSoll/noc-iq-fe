import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IncidentTimeline, { type TimelineEvent } from "@/components/timeline/IncidentTimeline";

const baseEvents: TimelineEvent[] = [
  {
    id: "1",
    timestamp: new Date().toISOString(),
    type: "user_action",
    label: "User clicked retry",
    detail: "Retry button pressed",
    outageId: "out-1",
  },
  {
    id: "2",
    timestamp: new Date(Date.now() + 1000).toISOString(),
    type: "backend_response",
    label: "API returned 500",
    detail: "Internal server error",
    causalityId: "1",
    outageId: "out-1",
  },
  {
    id: "3",
    timestamp: new Date(Date.now() + 2000).toISOString(),
    type: "payment",
    label: "Payment failed",
    detail: "Card declined",
    paymentId: "pay-1",
  },
];

describe("IncidentTimeline", () => {
  it("renders all events", () => {
    render(<IncidentTimeline events={baseEvents} />);
    expect(screen.getByText("User clicked retry")).toBeInTheDocument();
    expect(screen.getByText("API returned 500")).toBeInTheDocument();
    expect(screen.getByText("Payment failed")).toBeInTheDocument();
  });

  it("filters by outage ID", () => {
    render(<IncidentTimeline events={baseEvents} outageId="out-1" />);
    expect(screen.getByText("User clicked retry")).toBeInTheDocument();
    expect(screen.getByText("API returned 500")).toBeInTheDocument();
    expect(screen.queryByText("Payment failed")).not.toBeInTheDocument();
  });

  it("filters by payment ID", () => {
    render(<IncidentTimeline events={baseEvents} paymentId="pay-1" />);
    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.queryByText("User clicked retry")).not.toBeInTheDocument();
  });

  it("filters by event type", () => {
    render(<IncidentTimeline events={baseEvents} />);
    fireEvent.change(screen.getByDisplayValue("All types"), {
      target: { value: "user_action" },
    });
    expect(screen.getByText("User clicked retry")).toBeInTheDocument();
    expect(screen.queryByText("API returned 500")).not.toBeInTheDocument();
  });

  it("shows empty message when no events match", () => {
    render(<IncidentTimeline events={baseEvents} outageId="nonexistent" />);
    expect(screen.getByText("No events match the current filters.")).toBeInTheDocument();
  });

  it("exports JSON on click", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<IncidentTimeline events={baseEvents} />);
    fireEvent.click(screen.getByText("Export JSON"));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("displays event count", () => {
    render(<IncidentTimeline events={baseEvents} />);
    expect(screen.getByText("3 events")).toBeInTheDocument();
  });
});
