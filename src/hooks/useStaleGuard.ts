import type { UseQueryResult } from '@tanstack/react-query';

interface StaleGuardResult<T> {
  data: T | undefined;
  isStale: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
  error: UseQueryResult<T, Error>['error'];
}

export function useStaleGuard<T>(
  query: UseQueryResult<T, Error>
): StaleGuardResult<T> {
  return {
    guardedSubmit,
    conflict,
    dismissConflict,
    forceSubmit,
    isChecking,
    checkError,
  };
}
