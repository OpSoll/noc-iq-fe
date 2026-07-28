export function createBoundedMemoize<K, V>(maxSize: number, keyFn: (k: K) => string) {
  const cache = new Map<string, V>();
  function get(key: K): V | undefined { return cache.get(keyFn(key)); }
  function set(key: K, value: V): void {
    const k = keyFn(key);
    if (cache.size >= maxSize) { const first = cache.keys().next().value; if (first) cache.delete(first); }
    cache.set(k, value);
  }
  function has(key: K): boolean { return cache.has(keyFn(key)); }
  function clear(): void { cache.clear(); }
  return { get, set, has, clear, get size() { return cache.size; } };
}

export function memoizeTransform<TInput, TOutput>(fn: (input: TInput) => TOutput, keyFn: (input: TInput) => string, maxSize = 50) {
  const memo = createBoundedMemoize<TInput, TOutput>(maxSize, keyFn);
  return (input: TInput): TOutput => {
    const existing = memo.get(input);
    if (existing !== undefined) return existing;
    const result = fn(input);
    memo.set(input, result);
    return result;
  };
}
