import { api } from "@/lib/api";

export interface AnomalySegment {
  period: string;
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  severity: "low" | "medium" | "high";
  note: string;
}

export interface KPIConfidence {
  sampleSize: number;
  confidence: number;
  isSparse: boolean;
  warning?: string;
}

export async function fetchAnomalies(
  filters?: { date_from?: string; date_to?: string },
): Promise<AnomalySegment[]> {
  const params = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, v]) => v),
  );
  const res = await api.get<AnomalySegment[]>("/sla/analytics/anomalies", {
    params,
  });
  return res.data;
}

export function computeKPIConfidence(
  sampleSize: number,
  totalPopulation: number,
): KPIConfidence {
  const ratio = totalPopulation > 0 ? sampleSize / totalPopulation : 0;
  const confidence = Math.round(Math.min(ratio, 1) * 100);
  const isSparse = sampleSize < 30;

  return {
    sampleSize,
    confidence,
    isSparse,
    warning: isSparse
      ? `Based on ${sampleSize} samples — may not reflect full trend`
      : undefined,
  };
}
