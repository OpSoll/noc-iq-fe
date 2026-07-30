import { render, screen } from "@testing-library/react";
import Navigation from "@/components/Navigation";

import { beforeEach, describe, it, expect, vi } from "vitest";

// Mock the usePathname hook
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { SessionProvider } from "@/providers/session";
import { AccessibilityProvider } from "@/providers/accessibility";

describe("Navigation", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });
  it("should apply aria-current to the active link", () => {
    render(
      <AccessibilityProvider>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </AccessibilityProvider>,
    );
    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });
});
