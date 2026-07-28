import { QueryClient } from "@tanstack/react-query";

export function createRecoveryHandler(queryClient: QueryClient) {
  return {
    async retryFailedQueries() {
      const queries = queryClient.getQueryCache().getAll();
      const failed = queries.filter((q) => q.state.status === "error");
      await Promise.allSettled(failed.map((q) => queryClient.refetchQueries({ queryKey: q.queryKey, exact: true })));
      return failed.length;
    },
    getPendingRetries(): number {
      return queryClient.getQueryCache().getAll().filter((q) => q.state.status === "error").length;
    },
  };
}

const queryClientRef = { current: null as QueryClient | null };
