export type BackendMode = "online" | "degraded" | "maintenance" | "offline";

export type ResilienceState = {
  currentMode: BackendMode;
  previousMode: BackendMode;
  retryCount: number;
  isStable: boolean;
};

export type RouteResilienceResult<T> = {
  data: T | null;
  mode: BackendMode;
  fallbackUsed: boolean;
  error: string | null;
};

export function determineResilienceMode(status: number, retryCount: number): BackendMode {
  if (status >= 500) return retryCount > 2 ? "offline" : "degraded";
  if (status === 503) return "maintenance";
  return "online";
}

export function shouldRetry(status: number, retryCount: number, maxRetries: number = 3): boolean {
  if (retryCount >= maxRetries) return false;
  return [429, 500, 502, 503, 504].includes(status);
}

export function getFallbackData<T>(fallbackCache: Map<string, T>, key: string): T | null {
  return fallbackCache.get(key) ?? null;
}

export function buildResilienceFallback<T>(key: string, fallbackCache: Map<string, T>, mode: BackendMode): RouteResilienceResult<T> {
  const data = getFallbackData(fallbackCache, key);
  return {
    data,
    mode,
    fallbackUsed: !!data,
    error: mode === "offline" ? "Backend unavailable" : null,
  };
}
