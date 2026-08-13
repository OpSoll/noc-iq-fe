import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OutagesPageClient from "@/app/outages/components/outages-page-client";
import OutageDetailsPage from "@/app/outages/[id]/page";

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

import { ToastProvider } from "@/components/ui/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const testQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "outage-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const mockUseOutagesTableState = vi.fn();
const mockUseOutages = vi.fn();
const mockGetOutage = vi.fn();
const mockResolveOutage = vi.fn();
const mockPreviewSLA = vi.fn();

vi.mock("@/hooks/useOutagesTableState", () => ({
  useOutagesTableState: () => mockUseOutagesTableState(),
}));

vi.mock("@/features/outages/hooks/useOutages", () => ({
  useOutages: (...args: unknown[]) => mockUseOutages(...args),
}));

vi.mock("@/services/outages", () => ({
  getOutage: (...args: unknown[]) => mockGetOutage(...args),
  resolveOutage: (...args: unknown[]) => mockResolveOutage(...args),
}));

vi.mock("@/services/sla", () => ({
  previewSLA: (...args: unknown[]) => mockPreviewSLA(...args),
}));

const baseOutage = {
  id: "outage-1",
  site_name: "Lagos Core POP",
  severity: "critical",
  status: "open",
  detected_at: "2026-03-27T08:00:00.000Z",
  description: "Transit outage",
  affected_services: ["Backhaul", "Voice"],
  affected_subscribers: 3200,
};

describe("outages frontend flow", () => {
  beforeEach(() => {
    mockUseOutagesTableState.mockReset();
    mockUseOutages.mockReset();
    mockGetOutage.mockReset();
    mockResolveOutage.mockReset();
    mockPreviewSLA.mockReset();
    mockPreviewSLA.mockResolvedValue({
      status: "met",
      rating: "excellent",
      threshold_minutes: 60,
      amount: 150,
      payment_type: "reward",
    });
  });

  it("covers outage list browsing", async () => {
    mockUseOutagesTableState.mockReturnValue({
      state: { page: 1, page_size: 10, severity: undefined, status: undefined },
      actions: {
        setPage: vi.fn(),
        setPageSize: vi.fn(),
        setSeverity: vi.fn(),
        setStatus: vi.fn(),
      },
    });
    mockUseOutages.mockReturnValue({
      data: {
        items: [baseOutage],
        total: 1,
        page: 1,
        page_size: 10,
      },
      isLoading: false,
      isError: false,
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <ToastProvider>
          <OutagesPageClient
            data={[
              {
                id: "outage-1",
                title: "Lagos Core POP",
                severity: "critical",
                status: "open",
                createdAt: "2026-03-27T08:00:00.000Z",
              },
            ]}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Lagos Core POP")).toBeInTheDocument();
  });

  it("covers outage detail loading and resolution", async () => {
    mockGetOutage.mockResolvedValue(baseOutage);
    mockResolveOutage.mockResolvedValue({
      outage: {
        ...baseOutage,
        status: "resolved",
        resolved_at: "2026-03-27T09:00:00.000Z",
      },
      sla: {
        status: "met",
        mttr_minutes: 42,
        threshold_minutes: 60,
        amount: 150,
        payment_type: "reward",
        rating: "excellent",
      },
      payment: {
        id: "pay-1",
        transaction_hash: "tx-001",
        type: "reward",
        amount: 150,
        asset_code: "USDC",
        from_address: "from-address",
        to_address: "to-address",
        status: "pending",
        outage_id: "outage-1",
        sla_result_id: 12,
        created_at: "2026-03-27T09:00:00.000Z",
        confirmed_at: null,
      },
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <ToastProvider>
          <OutageDetailsPage />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Outage outage-1" })).toBeInTheDocument();
    expect(mockGetOutage).toHaveBeenCalledWith("outage-1", expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "Resolve Outage" }));

    const mttrInput = screen.getByLabelText("Mean time to resolve (minutes)");
    fireEvent.change(mttrInput, { target: { value: "42" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Review resolution" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm resolution" }));
    });

    await waitFor(() => {
      expect(mockResolveOutage).toHaveBeenCalledWith("outage-1", { mttr_minutes: 42 });
    });

    expect(await screen.findByText("pending")).toBeInTheDocument();
    expect(screen.getByText(/150 USDC/)).toBeInTheDocument();
  });
});
