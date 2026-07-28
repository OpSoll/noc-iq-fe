import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChartFallback from "../ChartFallback";

describe("ChartFallback", () => {
  it("renders default title and message", () => {
    render(<ChartFallback />);
    expect(screen.getByText("Chart unavailable")).toBeTruthy();
  });

  it("renders custom props", () => {
    render(<ChartFallback title="Custom" message="Details" />);
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<ChartFallback onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });
});
