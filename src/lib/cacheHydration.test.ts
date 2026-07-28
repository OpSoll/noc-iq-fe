import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { hydrateCache, createHydrationBoundary } from "./cacheHydration";

describe("hydrateCache", () => {
  it("sets initial data in cache", () => {
    const client = new QueryClient();
    hydrateCache(client, { dashboard: { total: 10 } });
    expect(client.getQueryData(["dashboard"])).toEqual({ total: 10 });
  });
});

describe("createHydrationBoundary", () => {
  it("tracks hydration state", () => {
    const client = new QueryClient();
    const boundary = createHydrationBoundary(client);
    expect(boundary.isHydrated("test")).toBe(false);
    boundary.markHydrated("test");
    expect(boundary.isHydrated("test")).toBe(true);
  });
  it("skips fetch if already hydrated", async () => {
    const client = new QueryClient();
    const boundary = createHydrationBoundary(client);
    client.setQueryData(["key"], "cached");
    boundary.markHydrated("key");
    const result = await boundary.prefetchWithHydration("key", async () => "fresh");
    expect(result).toBe("cached");
  });
});
