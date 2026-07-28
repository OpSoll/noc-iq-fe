import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FreshnessIndicator from "@/components/dashboard/FreshnessIndicator";

describe("FreshnessIndicator", () => {
  it("shows Fresh for recent timestamps", () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    render(<FreshnessIndicator lastUpdated={recent} />);
    expect(screen.getByText("Fresh")).toBeInTheDocument();
  });

  it("shows Stale for 10 minute old timestamps", () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    render(<FreshnessIndicator lastUpdated={stale} />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });

  it("shows Expired for old timestamps", () => {
    const expired = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(<FreshnessIndicator lastUpdated={expired} />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("accepts Date objects", () => {
    const recent = new Date(Date.now() - 30 * 1000);
    render(<FreshnessIndicator lastUpdated={recent} />);
    expect(screen.getByText("Fresh")).toBeInTheDocument();
  });
});
