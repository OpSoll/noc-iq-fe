export interface ConsistencyMismatch {
  metric: string;
  kpiValue: number;
  chartValue: number;
  delta: number;
  tolerance: number;
}

export interface ConsistencyResult {
  consistent: boolean;
  mismatches: ConsistencyMismatch[];
}

export interface Tolerances {
  [metric: string]: number;
}

const DEFAULT_TOLERANCES: Tolerances = {
  total_outages: 0,
  violations: 0.01,
  rewards: 0.01,
  penalties: 0.01,
};

export function checkConsistency(
  kpis: Record<string, number>,
  chartAggregates: Record<string, number>,
  tolerances: Tolerances = DEFAULT_TOLERANCES
): ConsistencyResult {
  const mismatches: ConsistencyMismatch[] = [];
  const allKeys = new Set([...Object.keys(kpis), ...Object.keys(chartAggregates)]);
  for (const key of allKeys) {
    const kpiVal = kpis[key] ?? 0;
    const chartVal = chartAggregates[key] ?? 0;
    const tolerance = tolerances[key] ?? 0.01;
    const delta = Math.abs(kpiVal - chartVal);
    if (delta > tolerance) {
      mismatches.push({ metric: key, kpiValue: kpiVal, chartValue: chartVal, delta, tolerance });
    }
  }
  return { consistent: mismatches.length === 0, mismatches };
}
