import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OutageDurationCounter } from "../OutageDurationCounter";

describe("OutageDurationCounter Component (#471)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders live duration for active outages (e.g. '2h 15m ongoing')", () => {
    const baseTime = new Date("2026-11-25T12:15:00.000Z");
    vi.setSystemTime(baseTime);

    // Detected 2h 15m ago
    const detectedAt = "2026-11-25T10:00:00.000Z";

    render(<OutageDurationCounter detectedAt={detectedAt} status="open" />);

    const counter = screen.getByTestId("outage-duration-counter");
    expect(counter).toBeInTheDocument();
    expect(counter).toHaveTextContent("2h 15m ongoing");

    // Under 4 hours: no pulsing red indicator
    expect(screen.queryByTestId("pulsing-red-indicator")).toBeNull();
  });

  it("applies pulsing red indicator when outage exceeds 4 hours (> 240 minutes)", () => {
    const baseTime = new Date("2026-11-25T14:30:00.000Z");
    vi.setSystemTime(baseTime);

    // Detected 4h 30m ago
    const detectedAt = "2026-11-25T10:00:00.000Z";

    render(<OutageDurationCounter detectedAt={detectedAt} status="open" />);

    const counter = screen.getByTestId("outage-duration-counter");
    expect(counter).toHaveTextContent("4h 30m ongoing");
    expect(counter).toHaveAttribute("data-over-four-hours", "true");

    const pulsingIndicator = screen.getByTestId("pulsing-red-indicator");
    expect(pulsingIndicator).toBeInTheDocument();
  });

  it("updates live counter text every minute", () => {
    const baseTime = new Date("2026-11-25T10:30:00.000Z");
    vi.setSystemTime(baseTime);

    // Detected 30 min ago
    const detectedAt = "2026-11-25T10:00:00.000Z";

    render(<OutageDurationCounter detectedAt={detectedAt} status="open" />);

    expect(screen.getByTestId("outage-duration-counter")).toHaveTextContent("30m ongoing");

    // Advance timer by 1 minute (60,000 ms)
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByTestId("outage-duration-counter")).toHaveTextContent("31m ongoing");
  });

  it("returns null when outage status is resolved", () => {
    const detectedAt = "2026-11-25T10:00:00.000Z";

    const { container } = render(
      <OutageDurationCounter detectedAt={detectedAt} status="resolved" />,
    );

    expect(container.firstChild).toBeNull();
  });
});
