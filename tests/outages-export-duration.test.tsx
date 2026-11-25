import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OutagesPageClient from "@/app/outages/components/outages-page-client";
import * as exportUtils from "@/lib/outagesDurationAndExport";
import { ToastProvider } from "@/components/ui/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "outage-alpha" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => {
    const params = new URLSearchParams(window.location.search);
    return {
      get: (key: string) => params.get(key),
      toString: () => params.toString(),
    };
  },
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({
    user: {
      id: "operator-1",
      email: "operator@example.test",
      role: "engineer",
    },
  }),
}));

vi.mock("@/hooks/useOutagesTableState", () => ({
  useOutagesTableState: () => ({
    state: { page: 1, page_size: 10, severity: undefined, status: undefined },
    actions: {
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      setSeverity: vi.fn(),
      setStatus: vi.fn(),
    },
  }),
}));

vi.mock("@/features/outages/hooks/useOutages", () => ({
  useOutages: () => ({
    data: { items: [], total: 0 },
    isLoading: false,
  }),
}));

const testOutages = [
  {
    id: "outage-alpha",
    site_name: "Johannesburg North",
    severity: "critical",
    status: "open",
    detected_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hours ago (> 4h)
    description: "Fiber line cut",
  },
  {
    id: "outage-beta",
    site_name: "Cape Town Hub",
    severity: "medium",
    status: "open",
    detected_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    description: "Router reload",
  },
  {
    id: "outage-gamma",
    site_name: "Durban POP",
    severity: "low",
    status: "resolved",
    detected_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    description: "Power dip",
  },
];

describe("Outages Page Client - Export CSV & Duration Counter (#471, #476)", () => {
  it("renders 'Export CSV' button in outages header and triggers downloadOutagesCsv on click (#476)", () => {
    const downloadSpy = vi.spyOn(exportUtils, "downloadOutagesCsv").mockImplementation(() => {});

    renderWithProviders(<OutagesPageClient data={testOutages} />);

    const exportBtn = screen.getByRole("button", { name: "Export CSV" });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: "outage-alpha" }),
      expect.objectContaining({ id: "outage-beta" }),
      expect.objectContaining({ id: "outage-gamma" }),
    ]));

    downloadSpy.mockRestore();
  });

  it("renders live duration counter and pulsing red indicator on active outage cards > 4 hours (#471)", () => {
    renderWithProviders(<OutagesPageClient data={testOutages} />);

    // Outage Alpha is 5 hours ongoing -> should have pulsing red indicator
    const cardAlpha = screen.getByTestId("incident-card-outage-alpha");
    expect(cardAlpha).toHaveTextContent(/5h 0m ongoing|4h 59m ongoing|5h 1m ongoing/);

    const pulsingIndicators = screen.getAllByTestId("pulsing-red-indicator");
    expect(pulsingIndicators.length).toBeGreaterThan(0);

    // Outage Beta is 30m ongoing -> counter exists but no pulsing red indicator on beta
    const cardBeta = screen.getByTestId("incident-card-outage-beta");
    expect(cardBeta).toHaveTextContent(/30m ongoing/);

    // Outage Gamma is resolved -> no duration counter
    const cardGamma = screen.getByTestId("incident-card-outage-gamma");
    expect(cardGamma).not.toHaveTextContent("ongoing");
  });
});
