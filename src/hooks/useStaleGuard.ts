import { useCallback, useRef, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';

import { api } from '@/lib/api';

export interface Timestamped {
  updated_at: string;
}

export interface StaleConflict {
  formUpdatedAt: string;
  serverUpdatedAt: string;
}

export interface UseStaleGuardOptions {
  endpoint: string;
  formUpdatedAt: string;
}

export interface UseStaleGuardReturn {
  guardedSubmit: (onSubmit: () => Promise<void> | void) => Promise<void>;
  conflict: StaleConflict | null;
  dismissConflict: () => void;
  forceSubmit: () => Promise<void>;
  isChecking: boolean;
  checkError: string | null;
}

export interface QueryStaleGuardResult<T> extends UseStaleGuardReturn {
  data: T | undefined;
  isStale: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
  error: UseQueryResult<T, Error>['error'];
} {
  const options = 'endpoint' in input ? input : null;
  const query: UseQueryResult<T, Error> | null = options
    ? null
    : (input as UseQueryResult<T, Error>);
  const [conflict, setConflict] = useState<StaleConflict | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const pendingSubmit = useRef<(() => void | Promise<void>) | null>(null);

  const guardedSubmit = useCallback(
    async (onSubmit: () => void | Promise<void>) => {
      if (!options) return;
      setIsChecking(true);
      setCheckError(null);
      setConflict(null);
      pendingSubmit.current = null;
      try {
        const response = await api.get<{ updated_at: string | number | Date }>(
          options.endpoint
        );
        const serverUpdatedAt = response.data.updated_at;
        if (timestamp(serverUpdatedAt) > timestamp(options.formUpdatedAt)) {
          pendingSubmit.current = onSubmit;
          setConflict({
            formUpdatedAt: options.formUpdatedAt,
            serverUpdatedAt,
          });
        } else {
          await onSubmit();
        }
      } catch (error) {
        setCheckError(
          error instanceof Error
            ? error.message
            : 'Failed to verify record freshness'
        );
      } finally {
        setIsChecking(false);
      }
    },
    [options]
  );

  const dismissConflict = useCallback(() => {
    pendingSubmit.current = null;
    setConflict(null);
  }, []);

  const forceSubmit = useCallback(async () => {
    const submit = pendingSubmit.current;
    pendingSubmit.current = null;
    setConflict(null);
    if (submit) await submit();
  }, []);

type StaleCheckResult =
  | { decision: 'proceed'; formUpdatedAt: string; serverUpdatedAt: string }
  | { decision: 'stale'; formUpdatedAt: string; serverUpdatedAt: string }
  | { decision: 'error'; formUpdatedAt: string; serverUpdatedAt: null; error: string };

export function useStaleGuard<T>(
  query: UseQueryResult<T, Error>,
): QueryStaleGuardResult<T>;
export function useStaleGuard(
  options: UseStaleGuardOptions,
): UseStaleGuardReturn;
export function useStaleGuard<T>(
  input: UseQueryResult<T, Error> | UseStaleGuardOptions,
): QueryStaleGuardResult<T> | UseStaleGuardReturn {
  const isQueryResult = !('endpoint' in input);
  const endpoint = isQueryResult ? undefined : input.endpoint;
  const formUpdatedAt = isQueryResult ? '' : input.formUpdatedAt;
  const [conflict, setConflict] = useState<StaleConflict | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const pendingSubmitRef = useRef<(() => Promise<void> | void) | null>(null);

  const checkFreshness = useCallback(async (): Promise<StaleCheckResult> => {
    if (!endpoint) {
      return { decision: 'proceed', formUpdatedAt, serverUpdatedAt: '' };
    }

    try {
      const response = await api.get<Timestamped>(endpoint);
      const serverUpdatedAt = response.data.updated_at;

      if (
        new Date(serverUpdatedAt).getTime() >
        new Date(formUpdatedAt).getTime()
      ) {
        return { decision: 'stale', formUpdatedAt, serverUpdatedAt };
      }

      return { decision: 'proceed', formUpdatedAt, serverUpdatedAt };
    } catch (error) {
      return {
        decision: 'error',
        formUpdatedAt,
        serverUpdatedAt: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify record freshness',
      };
    }
  }, [endpoint, formUpdatedAt]);

  const guardedSubmit = useCallback(
    async (onSubmit: () => Promise<void> | void) => {
      pendingSubmitRef.current = null;
      setCheckError(null);
      setConflict(null);
      setIsChecking(true);

      try {
        const result = await checkFreshness();
        if (result.decision === 'stale') {
          pendingSubmitRef.current = onSubmit;
          setConflict({
            formUpdatedAt: result.formUpdatedAt,
            serverUpdatedAt: result.serverUpdatedAt,
          });
        } else if (result.decision === 'error') {
          setCheckError(result.error);
        } else {
          await onSubmit();
        }
      } finally {
        setIsChecking(false);
      }
    },
    [checkFreshness],
  );

  const dismissConflict = useCallback(() => {
    setConflict(null);
    pendingSubmitRef.current = null;
  }, []);

  const forceSubmit = useCallback(async () => {
    const submit = pendingSubmitRef.current;
    setConflict(null);
    pendingSubmitRef.current = null;
    if (submit) await submit();
  }, []);

  const result: UseStaleGuardReturn = {
    guardedSubmit,
    conflict,
    isChecking,
    checkError,
    guardedSubmit,
    dismissConflict,
    forceSubmit,
    data: query?.isStale && query.isFetching ? undefined : query?.data,
    isStale: query?.isStale ?? false,
    isFetching: query?.isFetching ?? false,
    isLoading: query?.isLoading ?? false,
    isError: query?.isError ?? false,
    error: query?.error ?? null,
  };

  if (isQueryResult) {
    const query = input as UseQueryResult<T, Error>;
    return {
      ...result,
      data:
        query.isStale && query.isFetching ? undefined : query.data,
      isStale: query.isStale,
      isFetching: query.isFetching,
      isLoading: query.isLoading,
      isError: query.isError,
      error: query.error,
    };
  }

  return result;
}
