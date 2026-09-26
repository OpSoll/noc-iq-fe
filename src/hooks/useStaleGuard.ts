import { useCallback, useRef, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface StaleConflict {
  formUpdatedAt: string | number | Date;
  serverUpdatedAt: string | number | Date;
}

interface StaleGuardOptions {
  endpoint: string;
  formUpdatedAt: string | number | Date;
}

interface GuardActions {
  conflict: StaleConflict | null;
  isChecking: boolean;
  checkError: string | null;
  guardedSubmit: (onSubmit: () => void | Promise<void>) => Promise<void>;
  dismissConflict: () => void;
  forceSubmit: () => Promise<void>;
}

function timestamp(value: string | number | Date): number {
  return value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : new Date(value).getTime();
}

export function useStaleGuard<T>(
  input: StaleGuardOptions | UseQueryResult<T, Error>
): GuardActions & {
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

  return {
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
}
