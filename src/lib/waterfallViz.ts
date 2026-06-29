export type WaterfallEntry = {
  attempt: number;
  timestamp: string;
  status: "queued" | "in_flight" | "delivered" | "failed";
  latencyMs: number;
  statusCode: number | null;
};

export type WaterfallData = {
  webhookId: string;
  eventType: string;
  entries: WaterfallEntry[];
  totalAttempts: number;
  totalDurationMs: number;
};

export function buildWaterfall(webhookId: string, eventType: string, entries: WaterfallEntry[]): WaterfallData {
  const totalDuration = entries.reduce((sum, e) => sum + e.latencyMs, 0);
  return { webhookId, eventType, entries, totalAttempts: entries.length, totalDurationMs: totalDuration };
}

export function getWaterfallStats(waterfall: WaterfallData): { avgLatencyMs: number; successRate: number; lastStatus: string } {
  const delivered = waterfall.entries.filter((e) => e.status === "delivered").length;
  return {
    avgLatencyMs: waterfall.totalAttempts > 0 ? Math.round(waterfall.totalDurationMs / waterfall.totalAttempts) : 0,
    successRate: waterfall.totalAttempts > 0 ? Math.round((delivered / waterfall.totalAttempts) * 100) : 0,
    lastStatus: waterfall.entries[waterfall.entries.length - 1]?.status || "unknown",
  };
}

export function waterfallToChartData(waterfall: WaterfallData): { labels: string[]; values: number[]; colors: string[] } {
  return {
    labels: waterfall.entries.map((e) => `Attempt ${e.attempt}`),
    values: waterfall.entries.map((e) => e.latencyMs),
    colors: waterfall.entries.map((e) =>
      e.status === "delivered" ? "#22c55e" : e.status === "failed" ? "#ef4444" : "#f59e0b"
    ),
  };
}
