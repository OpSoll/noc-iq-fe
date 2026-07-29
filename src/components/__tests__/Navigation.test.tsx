import { render, screen } from "@testing-library/react";
import Navigation from "@/components/Navigation";

// Mock the usePathname hook
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Navigation", () => {
  it("should apply aria-current to the active link", () => {
    render(<Navigation />);
    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });
});
