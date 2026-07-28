// Closes #336: typed fetch-based client (opt-in alternative to axios)
// Closes #236: cache shape validation + self-heal for corrupted entries

export interface FetchClientOptions extends RequestInit {
  baseUrl?: string;
}

export async function typedFetch<T>(path: string, opts: FetchClientOptions = {}): Promise<T> {
  const { baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1", ...rest } = opts;
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...rest.headers },
    ...rest,
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export type CacheShapeValidator<T> = (value: unknown) => value is T;

export interface HealResult<T> {
  valid: boolean;
  value: T | null;
}

// Validates a cached entry against `isValid`; evicts it from `cache` if corrupted.
export function validateAndHeal<T>(
  cache: Map<string, unknown>,
  key: string,
  isValid: CacheShapeValidator<T>,
): HealResult<T> {
  const entry = cache.get(key);
  if (entry !== undefined && isValid(entry)) {
    return { valid: true, value: entry };
  }
  if (entry !== undefined) {
    cache.delete(key);
  }
  return { valid: false, value: null };
}
