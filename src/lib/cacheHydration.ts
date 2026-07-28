import { QueryClient } from "@tanstack/react-query";

export function hydrateCache(queryClient: QueryClient, initialState: Record<string, unknown>): void {
  for (const [key, data] of Object.entries(initialState)) {
    queryClient.setQueryData([key], data);
  }
}

export function createHydrationBoundary(queryClient: QueryClient) {
  const hydrated = new Set<string>();
  return {
    isHydrated(key: string): boolean { return hydrated.has(key); },
    markHydrated(key: string): void { hydrated.add(key); },
    async prefetchWithHydration<T>(key: string, fetcher: () => Promise<T>): Promise<T | undefined> {
      if (hydrated.has(key)) return queryClient.getQueryData<T>([key]);
      const data = await fetcher();
      queryClient.setQueryData([key], data);
      hydrated.add(key);
      return data;
    },
  };
}
