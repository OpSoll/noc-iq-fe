import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { describe, it, beforeEach, expect, vi } from "vitest";
import { api } from "@/lib/api";
import { useSlaConfig, useUpdateSlaConfig } from "@/hooks/useSlaConfig";

vi.mock("@/lib/api");
const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useSlaConfig", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  describe("loading state", () => {
    it("starts in loading state before API resolves", () => {
      // Never resolve the promise so isLoading stays true
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });

  describe("successful fetch", () => {
    it("populates cache after successful fetch", async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { critical: { threshold_minutes: 30, penalty_per_minute: 5, reward_base: 100 } },
      });

      const { result } = renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].severity).toBe("critical");
      expect(result.current.data?.[0].threshold_minutes).toBe(30);
      expect(result.current.data?.[0].penalty_per_minute).toBe(5);
      expect(result.current.data?.[0].reward_base).toBe(100);
    });

    it("sorts results by severity order (critical first, low last)", async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: {
          low: { threshold_minutes: 240, penalty_per_minute: 0.5, reward_base: 10 },
          critical: { threshold_minutes: 30, penalty_per_minute: 5, reward_base: 100 },
          high: { threshold_minutes: 60, penalty_per_minute: 2, reward_base: 50 },
        },
      });

      const { result } = renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].severity).toBe("critical");
      expect(result.current.data?.[1].severity).toBe("high");
      expect(result.current.data?.[2].severity).toBe("low");
    });
  });

  describe("error state", () => {
    it("sets error state when API call fails", async () => {
      mockedApi.get.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it("does not retry when retry is disabled", async () => {
      mockedApi.get.mockRejectedValue(new Error("Server error"));

      renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });

      // With retry: false, the query should only fire once
      await vi.waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("refetch", () => {
    it("refetches data when refetch is called", async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { critical: { threshold_minutes: 30, penalty_per_minute: 5, reward_base: 100 } },
      });

      const { result } = renderHook(() => useSlaConfig(), { wrapper: makeWrapper(client) });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      // Second call for refetch
      mockedApi.get.mockResolvedValueOnce({
        data: { critical: { threshold_minutes: 15, penalty_per_minute: 10, reward_base: 200 } },
      });

      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.[0].threshold_minutes).toBe(15);
    });
  });

  describe("cache invalidation", () => {
    it("updates cache entry after mutation without refetch", async () => {
      const initial = [{ severity: "high", threshold_minutes: 60, penalty_per_minute: 2, reward_base: 50 }];
      client.setQueryData(["sla", "config"], initial);

      mockedApi.put.mockResolvedValueOnce({
        data: { threshold_minutes: 45, penalty_per_minute: 3, reward_base: 50 },
      });

      const { result } = renderHook(() => useUpdateSlaConfig(), { wrapper: makeWrapper(client) });
      result.current.mutate({ severity: "high", threshold_minutes: 45, penalty_per_minute: 3, reward_base: 50 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const cached = client.getQueryData<typeof initial>(["sla", "config"]);
      expect(cached?.[0].threshold_minutes).toBe(45);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it("keeps other severity entries unchanged during mutation", async () => {
      const initial = [
        { severity: "critical" as const, threshold_minutes: 30, penalty_per_minute: 5, reward_base: 100 },
        { severity: "high" as const, threshold_minutes: 60, penalty_per_minute: 2, reward_base: 50 },
      ];
      client.setQueryData(["sla", "config"], initial);

      mockedApi.put.mockResolvedValueOnce({
        data: { threshold_minutes: 45, penalty_per_minute: 3, reward_base: 50 },
      });

      const { result } = renderHook(() => useUpdateSlaConfig(), { wrapper: makeWrapper(client) });
      result.current.mutate({ severity: "high", threshold_minutes: 45, penalty_per_minute: 3, reward_base: 50 });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const cached = client.getQueryData<typeof initial>(["sla", "config"]);
      expect(cached).toHaveLength(2);
      expect(cached?.[0].threshold_minutes).toBe(30); // critical unchanged
      expect(cached?.[1].threshold_minutes).toBe(45); // high updated
    });
  });
});
