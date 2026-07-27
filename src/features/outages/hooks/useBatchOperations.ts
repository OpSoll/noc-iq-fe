"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";

import {
  batchAcknowledgeOutages,
  batchRecalculateSLA,
  batchResolveOutages,
} from "@/services/outages";

import { outageKeys } from "./useOutageMutations";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type BatchOperation = "acknowledge" | "resolve" | "recalculate-sla";

export interface BatchProgress {
  total: number;
  processed: number;
  operation: BatchOperation;
}

export interface BatchResult {
  total: number;
  success: number;
  failure: number;
  errors: Array<{ id: string; error: string }>;
  operation: BatchOperation;
}

export interface UseBatchOperationsReturn {
  /** The current operation being executed, if any */
  progress: BatchProgress | null;
  /** The last completed result summary */
  result: BatchResult | null;
  /** Execute a batch acknowledge on the given IDs */
  acknowledge: (ids: string[]) => Promise<BatchResult>;
  /** Execute a batch resolve on the given IDs */
  resolve: (ids: string[], mttrMinutes?: number) => Promise<BatchResult>;
  /** Execute a batch SLA recalculation on the given IDs */
  recalculateSLA: (ids: string[]) => Promise<BatchResult>;
  /** Whether any batch operation is in progress */
  isExecuting: boolean;
  /** Clear the result summary */
  clearResult: () => void;
}

/* -------------------------------------------------------------------------- */
/*                                    Hook                                    */
/* -------------------------------------------------------------------------- */

export function useBatchOperations(): UseBatchOperationsReturn {
  const queryClient = useQueryClient();

  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);

  const buildResult = useCallback(
    (
      operation: BatchOperation,
      total: number,
      response: { success_count: number; failure_count: number; errors?: Array<{ id: string; error: string }> },
    ): BatchResult => ({
      total,
      success: response.success_count,
      failure: response.failure_count,
      errors: response.errors ?? [],
      operation,
    }),
    [],
  );

  const executeWithProgress = useCallback(
    async <T>(
      operation: BatchOperation,
      ids: string[],
      apiCall: () => Promise<T>,
      onSuccess: (data: T) => void,
    ): Promise<BatchResult> => {
      const total = ids.length;
      setProgress({ total, processed: 0, operation });
      setResult(null);

      try {
        const data = await apiCall();
        setProgress({ total, processed: total, operation });
        const res = buildResult(operation, total, data as any);
        setResult(res);
        onSuccess(data);
        return res;
      } catch (error) {
        const failureResult: BatchResult = {
          total,
          success: 0,
          failure: total,
          errors: ids.map((id) => ({
            id,
            error: error instanceof Error ? error.message : "Batch operation failed",
          })),
          operation,
        };
        setResult(failureResult);
        return failureResult;
      } finally {
        setProgress(null);
      }
    },
    [buildResult],
  );

  const acknowledgeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return executeWithProgress(
        "acknowledge",
        ids,
        () => batchAcknowledgeOutages(ids),
        () => {
          void queryClient.invalidateQueries({ queryKey: outageKeys.all });
        },
      );
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ ids, mttrMinutes }: { ids: string[]; mttrMinutes?: number }) => {
      return executeWithProgress(
        "resolve",
        ids,
        () => batchResolveOutages(ids, { mttr_minutes: mttrMinutes }),
        () => {
          void queryClient.invalidateQueries({ queryKey: outageKeys.all });
        },
      );
    },
  });

  const recalculateSLAMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return executeWithProgress(
        "recalculate-sla",
        ids,
        () => batchRecalculateSLA(ids),
        () => {
          void queryClient.invalidateQueries({ queryKey: outageKeys.all });
        },
      );
    },
  });

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    progress,
    result,
    acknowledge: (ids: string[]) => acknowledgeMutation.mutateAsync(ids),
    resolve: (ids: string[], mttrMinutes?: number) =>
      resolveMutation.mutateAsync({ ids, mttrMinutes }),
    recalculateSLA: (ids: string[]) => recalculateSLAMutation.mutateAsync(ids),
    isExecuting:
      acknowledgeMutation.isPending ||
      resolveMutation.isPending ||
      recalculateSLAMutation.isPending,
    clearResult,
  };
}
