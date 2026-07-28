type Fetcher<T> = () => Promise<T>;

interface InFlightRequest<T> {
  promise: Promise<T>;
  refCount: number;
}

export function createCoalescer() {
  const inflight = new Map<string, InFlightRequest<unknown>>();

  async function request<T>(key: string, fetcher: Fetcher<T>, options?: { authScope?: string }): Promise<T> {
    const fullKey = options?.authScope ? `${key}:${options.authScope}` : key;
    const existing = inflight.get(fullKey);
    if (existing) {
      existing.refCount++;
      return existing.promise as Promise<T>;
    }
    const promise = fetcher().finally(() => {
      const entry = inflight.get(fullKey);
      if (entry && --entry.refCount <= 0) inflight.delete(fullKey);
    });
    inflight.set(fullKey, { promise, refCount: 1 });
    return promise;
  }

  function clear(): void { inflight.clear(); }
  function getInflightCount(): number { return inflight.size; }
  return { request, clear, getInflightCount };
}
