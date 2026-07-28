import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useWalletDetail, useWalletStatus, useWalletBalance } from "@/hooks/useWallet";

vi.mock("@/services/wallet", () => ({
  getWalletDetail: vi.fn(),
  getWalletStatus: vi.fn(),
  getWalletBalance: vi.fn(),
}));

import { getWalletDetail, getWalletStatus, getWalletBalance } from "@/services/wallet";

const mockGetWalletDetail = vi.mocked(getWalletDetail);
const mockGetWalletStatus = vi.mocked(getWalletStatus);
const mockGetWalletBalance = vi.mocked(getWalletBalance);

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

// Override retry for error tests since hooks set retry:1
function createNoRetryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

describe("useWallet hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useWalletDetail", () => {
    it("does not auto-fetch when userId is undefined", () => {
      const client = createQueryClient();
      renderHook(() => useWalletDetail(undefined), { wrapper: makeWrapper(client) });
      expect(mockGetWalletDetail).not.toHaveBeenCalled();
    });

    it("fetches and returns wallet data when userId is provided", async () => {
      const client = createQueryClient();
      mockGetWalletDetail.mockResolvedValueOnce({
        user_id: "u1",
        public_key: "GABC",
        created_at: "2026-01-01T00:00:00Z",
        last_updated: "2026-01-01T00:00:00Z",
        funded: true,
        active: true,
        trustline_ready: true,
      });

      const { result } = renderHook(() => useWalletDetail("u1"), { wrapper: makeWrapper(client) });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.public_key).toBe("GABC");
      expect(mockGetWalletDetail).toHaveBeenCalledWith("u1", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it("reports error on failed fetch", async () => {
      const client = createQueryClient();
      // retry:1 in the hook means two calls total (initial + 1 retry)
      mockGetWalletDetail.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useWalletDetail("u1"), { wrapper: makeWrapper(client) });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
      expect(result.current.error?.message).toBe("Network error");
    });
  });

  describe("useWalletStatus", () => {
    it("fetches wallet status when userId is provided", async () => {
      const client = createQueryClient();
      mockGetWalletStatus.mockResolvedValueOnce({
        user_id: "u1",
        public_key: "GABC",
        funded: true,
        trustline_ready: true,
        usable: true,
        active: true,
        last_updated: "2026-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useWalletStatus("u1"), { wrapper: makeWrapper(client) });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.usable).toBe(true);
    });
  });

  describe("useWalletBalance", () => {
    it("fetches wallet balance when address is provided", async () => {
      const client = createQueryClient();
      mockGetWalletBalance.mockResolvedValueOnce({
        address: "GABC",
        balances: { XLM: { balance: "100.0", asset_type: "native" } },
        last_updated: "2026-01-01T00:00:00Z",
      });

      const { result } = renderHook(() => useWalletBalance("GABC"), { wrapper: makeWrapper(client) });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.balances.XLM.balance).toBe("100.0");
    });
  });

  describe("query cancellation via key change", () => {
    it("fetches new data when query key changes", async () => {
      const client = createQueryClient();

      mockGetWalletDetail.mockResolvedValue({
        user_id: "u1",
        public_key: "GABC",
        created_at: "2026-01-01T00:00:00Z",
        last_updated: "2026-01-01T00:00:00Z",
        funded: true,
        active: true,
        trustline_ready: true,
      });

      const { result, rerender } = renderHook(
        ({ userId }) => useWalletDetail(userId),
        { wrapper: makeWrapper(client), initialProps: { userId: "u1" } },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.user_id).toBe("u1");

      // Change the query key to a different user
      mockGetWalletDetail.mockResolvedValueOnce({
        user_id: "u2",
        public_key: "GDEF",
        created_at: "2026-01-01T00:00:00Z",
        last_updated: "2026-01-01T00:00:00Z",
        funded: true,
        active: true,
        trustline_ready: true,
      });

      rerender({ userId: "u2" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.user_id).toBe("u2");
      expect(result.current.data?.public_key).toBe("GDEF");
    });
  });
});
