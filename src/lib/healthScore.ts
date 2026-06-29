export type HealthScoreWeights = {
  successRate: number;
  avgLatency: number;
  uptime: number;
  recentErrors: number;
};

export type HealthScoreResult = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  degradationHints: string[];
};

const defaultWeights: HealthScoreWeights = {
  successRate: 0.4,
  avgLatency: 0.2,
  uptime: 0.25,
  recentErrors: 0.15,
};

export function calculateHealthScore(
  successRate: number,
  avgLatencyMs: number,
  uptimePercent: number,
  recentErrors: number,
  weights: HealthScoreWeights = defaultWeights,
): HealthScoreResult {
  const latencyScore = Math.max(0, 100 - avgLatencyMs / 10);
  const errorScore = Math.max(0, 100 - recentErrors * 10);

  const score = Math.round(
    successRate * weights.successRate +
    latencyScore * weights.avgLatency +
    uptimePercent * weights.uptime +
    errorScore * weights.recentErrors,
  );

  const hints: string[] = [];
  if (successRate < 90) hints.push(`Success rate (${successRate}%) below 90%`);
  if (avgLatencyMs > 500) hints.push(`High latency (${avgLatencyMs}ms)`);
  if (uptimePercent < 99) hints.push(`Uptime (${uptimePercent}%) below 99%`);
  if (recentErrors > 5) hints.push(`${recentErrors} recent errors detected`);

  const grade: HealthScoreResult["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return { score, grade, degradationHints: hints };
}
