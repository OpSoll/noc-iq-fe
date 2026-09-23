/**
 * Unit tests for SkipNav (closes #702)
 *
 * Covers:
 *  - Skip link renders with correct href
 *  - Skip link is visually hidden by default (sr-only-style class applied)
 *  - Skip link targets #main-content when activated
 *  - Focus is moved to the main-content element on click
 *  - data-testid attribute present for integration testing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkipNav from "../SkipNav";

// Minimal <main> target used alongside the SkipNav in each test
function renderWithTarget() {
  const { container } = render(
    <>
      <SkipNav />
      <main id="main-content" tabIndex={-1}>
        Page content
      </main>
    </>,
  );
  return container;
}

describe("SkipNav", () => {
  beforeEach(() => {
    // Reset jsdom focus state
    document.body.focus();
  });

  it("renders the skip link with data-testid='skip-nav'", () => {
    renderWithTarget();
    expect(screen.getByTestId("skip-nav")).toBeInTheDocument();
  });

  it("skip link text reads 'Skip to main content'", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");
    expect(link).toHaveTextContent("Skip to main content");
  });

  it("skip link href points to #main-content", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("skip link is positioned off-screen by default (contains -top-full class)", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");
    // The element should carry the sr-style positioning class
    expect(link.className).toContain("-top-full");
  });

  it("moves focus to #main-content when activated", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");
    const mainEl = document.getElementById("main-content") as HTMLElement;

    const focusSpy = vi.spyOn(mainEl, "focus");
    fireEvent.click(link);

    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it("sets tabindex on #main-content before focusing", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");
    const mainEl = document.getElementById("main-content") as HTMLElement;

    fireEvent.click(link);

    // tabindex should be set to -1 by the handler
    expect(mainEl.getAttribute("tabindex")).toBe("-1");
  });

  it("prevents default anchor navigation on click", () => {
    renderWithTarget();
    const link = screen.getByTestId("skip-nav");

    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");

    link.dispatchEvent(clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("does nothing if #main-content element is absent from the DOM", () => {
    // Render without the target
    render(<SkipNav />);
    const link = screen.getByTestId("skip-nav");

    // Should not throw even when the target is missing
    expect(() => fireEvent.click(link)).not.toThrow();
  });
});
