export type DeliveryEntry = {
  id: string;
  webhookId: string;
  timestamp: string;
  status: "queued" | "in_flight" | "delivered" | "failed" | "retrying";
  latencyMs: number;
  attempt: number;
};

export type StreamState = {
  isPolling: boolean;
  entries: DeliveryEntry[];
  backoffMs: number;
  error: string | null;
};

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

export function createStreamState(): StreamState {
  return { isPolling: false, entries: [], backoffMs: BASE_BACKOFF_MS, error: null };
}

export function calculateBackoff(currentBackoffMs: number, success: boolean): number {
  if (success) return BASE_BACKOFF_MS;
  return Math.min(currentBackoffMs * 2, MAX_BACKOFF_MS);
}

export function addDeliveryEntry(state: StreamState, entry: DeliveryEntry): StreamState {
  return { ...state, entries: [...state.entries, entry].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) };
}

export function getStreamStats(entries: DeliveryEntry[]): { total: number; successRate: number; avgLatency: number } {
  const delivered = entries.filter((e) => e.status === "delivered").length;
  return {
    total: entries.length,
    successRate: entries.length > 0 ? Math.round((delivered / entries.length) * 100) : 0,
    avgLatency: entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.latencyMs, 0) / entries.length) : 0,
  };
}
