import type { UseQueryResult } from "@tanstack/react-query";

interface StaleGuardResult<T> {
  data: T | undefined;
  isStale: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
  error: UseQueryResult<T, Error>["error"];
}

export function useStaleGuard<T>(
  query: UseQueryResult<T, Error>,
): StaleGuardResult<T> {
  return {
    data: query.isStale && query.isFetching ? undefined : query.data,
    isStale: query.isStale,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
