import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/setting/page";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockToast = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
  getAccessToken: () => null,
  clearTokens: vi.fn(),
  setTokens: vi.fn(),
}));
vi.mock("@/lib/explorer", () => ({ explorerLink: () => null, STELLAR_NETWORK_LABEL: "Testnet" }));
vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({ state: "unauthenticated", user: null, logout: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockToast.mockReset(); });

  it("renders with unauthenticated state and no wallet", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("Settings and Wallet Control")).toBeInTheDocument();
    expect(screen.getByText("Not signed in.")).toBeInTheDocument();
    expect(screen.getByText("Not linked")).toBeInTheDocument();
  });

  it("shows wallet details after loading", async () => {
    const wallet = { user_id: "u1", public_key: "GABC", funded: true, trustline_ready: true, active: true, created_at: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z" };
    const walletStatus = { user_id: "u1", public_key: "GABC", funded: true, trustline_ready: true, usable: true, active: true, last_updated: "2026-01-01T00:00:00Z" };

    mockGet.mockResolvedValueOnce({ data: wallet }).mockResolvedValueOnce({ data: walletStatus });
    renderWithProviders(<SettingsPage />);
    fireEvent.change(screen.getByPlaceholderText("User ID"), { target: { value: "u1" } });
    fireEvent.click(screen.getByRole("button", { name: /load wallet details/i }));
    expect(mockToast).toHaveBeenCalledWith("Wallet details loaded.", "success");
  });

  it("shows error toast when loading wallet without user id", async () => {
    renderWithProviders(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: /load wallet details/i }));
    expect(mockToast).toHaveBeenCalledWith("Provide a user ID or log in before loading wallet details.", "error");
  });

  it("shows WalletHealthBadge in wallet section", async () => {
    renderWithProviders(<SettingsPage />);
    const notLoadedElements = screen.getAllByText("Not loaded");
    expect(notLoadedElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows ready guidance when wallet is usable", async () => {
    const wallet = { user_id: "u1", public_key: "GABC", funded: true, trustline_ready: true, active: true, created_at: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z" };
    const walletStatus = { user_id: "u1", public_key: "GABC", funded: true, trustline_ready: true, usable: true, active: true, last_updated: "2026-01-01T00:00:00Z" };

    mockGet.mockResolvedValueOnce({ data: wallet }).mockResolvedValueOnce({ data: walletStatus });
    renderWithProviders(<SettingsPage />);
    fireEvent.change(screen.getByPlaceholderText("User ID"), { target: { value: "u1" } });
    fireEvent.click(screen.getByRole("button", { name: /load wallet details/i }));
    expect(await screen.findByText(/Wallet is fully ready/)).toBeInTheDocument();
  });

  it("shows not-ready guidance when wallet is unusable", async () => {
    const wallet = { user_id: "u1", public_key: "GABC", funded: true, trustline_ready: true, active: true, created_at: "2026-01-01T00:00:00Z", last_updated: "2026-01-01T00:00:00Z" };
    const walletStatus = { user_id: "u1", public_key: "GABC", funded: false, trustline_ready: false, usable: false, active: true, last_updated: "2026-01-01T00:00:00Z" };

    mockGet.mockResolvedValueOnce({ data: wallet }).mockResolvedValueOnce({ data: walletStatus });
    renderWithProviders(<SettingsPage />);
    fireEvent.change(screen.getByPlaceholderText("User ID"), { target: { value: "u1" } });
    fireEvent.click(screen.getByRole("button", { name: /load wallet details/i }));
    expect(await screen.findByText("Wallet Not Ready — Next Steps")).toBeInTheDocument();
  });
});
