import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/toast";
import Navigation from "@/components/Navigation";

import { beforeEach, it, expect, vi } from "vitest";

// Mock the usePathname hook
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { SessionProvider } from "@/providers/session";
import { AccessibilityProvider } from "@/providers/accessibility";

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
        <ToastProvider>
          <Navigation />
        </ToastProvider>
      </SessionProvider>
    </AccessibilityProvider>,
  );
  const dashboardLink = screen.getByText("Dashboard");
  expect(dashboardLink).toHaveAttribute("aria-current", "page");
});

function AlertSource() {
  const toast = useToast();
  return (
    <button onClick={() => toast("Payment processing failed", "error")}>
      Send alert
    </button>
  );
}

it("renders recent alerts, clears unread counts, and supports keyboard dismissal", async () => {
  const user = userEvent.setup();
  render(
    <AccessibilityProvider>
      <SessionProvider>
        <ToastProvider>
          <Navigation />
          <AlertSource />
        </ToastProvider>
      </SessionProvider>
    </AccessibilityProvider>,
  );
  const bell = screen.getByRole("button", { name: "Notifications, 0 unread" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  await user.click(bell);
  expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Mark All as Read" }),
  ).toHaveAttribute("data-disabled");
  await user.keyboard("{Escape}");
  expect(bell).toHaveFocus();
  for (let i = 0; i < 3; i++) await user.click(screen.getByText("Send alert"));
  expect(
    screen.getByRole("button", { name: "Notifications, 3 unread" }),
  ).toBeInTheDocument();
  expect(within(bell).getByText("3")).toHaveClass("bg-red-600");
  await user.click(bell);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(
    within(screen.getByRole("list", { name: "Recent alerts" })).getAllByText(
      "Payment processing failed",
    ),
  ).toHaveLength(3);
  await user.click(screen.getByRole("menuitem", { name: "Mark All as Read" }));
  expect(bell).toHaveAccessibleName("Notifications, 0 unread");
  expect(within(bell).queryByText("3")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  await user.click(screen.getByText("Send alert"));
  expect(bell).toHaveAccessibleName("Notifications, 1 unread");
});
