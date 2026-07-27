/**
 * API latency percentile tracking by endpoint group.
 * Tracks p50/p90/p99 for key endpoint groups with outlier linkability.
 */

export type EndpointGroup = "outages" | "payments" | "sla" | "webhooks";

export interface LatencyEntry {
  durationMs: number;
  timestamp: number;
  correlationId?: string;
  route: string;
  group: EndpointGroup;
}

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p99: number;
  count: number;
}

export interface EnvironmentTag {
  env: string;
  route: string;
  requestClass: string;
}

// ── Group mapping ────────────────────────────────────────────────────────────

const GROUP_PREFIXES: [string, EndpointGroup][] = [
  ["/outages", "outages"],
  ["/payments", "payments"],
  ["/sla", "sla"],
  ["/webhooks", "webhooks"],
];

export function classifyEndpoint(path: string): EndpointGroup | null {
  for (const [prefix, group] of GROUP_PREFIXES) {
    if (path.startsWith(prefix)) return group;
  }
  return null;
}

// ── In-memory store ──────────────────────────────────────────────────────────

const entries: LatencyEntry[] = [];
const MAX_ENTRIES = 1000;

export function recordLatency(
  durationMs: number,
  route: string,
  correlationId?: string,
): void {
  const group = classifyEndpoint(route);
  if (!group) return;

  const entry: LatencyEntry = {
    durationMs,
    timestamp: Date.now(),
    correlationId,
    route,
    group,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getEntries(): readonly LatencyEntry[] {
  return [...entries];
}

export function clearEntries(): void {
  entries.length = 0;
}

// ── Percentile computation ───────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function computePercentiles(group: EndpointGroup): LatencyPercentiles {
  const durations = entries
    .filter((e) => e.group === group)
    .map((e) => e.durationMs)
    .sort((a, b) => a - b);

  return {
    p50: percentile(durations, 50),
    p90: percentile(durations, 90),
    p99: percentile(durations, 99),
    count: durations.length,
  };
}

// ── Outlier detection ────────────────────────────────────────────────────────

export function findOutliers(group: EndpointGroup, thresholdP99 = true): LatencyEntry[] {
  const groupEntries = entries.filter((e) => e.group === group);
  if (groupEntries.length < 10) return [];

  const durations = groupEntries.map((e) => e.durationMs).sort((a, b) => a - b);
  const p99Val = percentile(durations, 99);

  if (!thresholdP99) {
    return [];
  }

  return groupEntries.filter((e) => e.durationMs >= p99Val);
}

// ── Environment tagging ──────────────────────────────────────────────────────

export function tagEnvironment(
  group: EndpointGroup,
  route: string,
  requestClass: string,
): EnvironmentTag {
  return {
    env: process.env.NODE_ENV ?? "unknown",
    route,
    requestClass,
  };
}

// ── Reset ────────────────────────────────────────────────────────────────────

export function resetLatencyStore(): void {
  entries.length = 0;
}
