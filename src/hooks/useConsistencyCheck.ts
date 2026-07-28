"use client";
import { useMemo } from "react";
import { checkConsistency, type ConsistencyResult } from "@/lib/consistencyCheck";

interface UseConsistencyCheckOptions {
  kpis?: Record<string, number>;
  chartAggregates?: Record<string, number>;
  tolerances?: Record<string, number>;
}

export function useConsistencyCheck({
  kpis,
  chartAggregates,
  tolerances,
}: UseConsistencyCheckOptions): ConsistencyResult | null {
  return useMemo(() => {
    if (!kpis || !chartAggregates) return null;
    return checkConsistency(kpis, chartAggregates, tolerances);
  }, [kpis, chartAggregates, tolerances]);
}
