export interface TimeInterval {
  start: string;
  end: string;
  granularity: "hour" | "day" | "week" | "month";
}

export function validateIntervalCompatibility(a: TimeInterval, b: TimeInterval): { compatible: boolean; reason?: string } {
  if (a.granularity !== b.granularity) return { compatible: false, reason: `Granularity mismatch: ${a.granularity} vs ${b.granularity}` };
  return { compatible: true };
}

export interface DeltaResult { metric: string; baseline: number; current: number; delta: number; deltaPercent: number; }

export function computeDeltas(baseline: Record<string, number>, current: Record<string, number>): DeltaResult[] {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  return Array.from(keys).map((k) => {
    const b = baseline[k] ?? 0, c = current[k] ?? 0;
    return { metric: k, baseline: b, current: c, delta: c - b, deltaPercent: b !== 0 ? ((c - b) / b) * 100 : 0 };
  });
}

export function imputeMissingIntervals(data: Record<string, unknown>[], expected: string[], dateKey = "period"): Record<string, unknown>[] {
  const present = new Set(data.map((d) => d[dateKey]));
  const imputed = expected.filter((e) => !present.has(e)).map((e) => ({ [dateKey]: e, imputed: true }));
  return [...data, ...imputed];
}
