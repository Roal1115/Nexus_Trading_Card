const cache = new Map<string, { data: any; ts: number }>();

export function getCached<T>(key: string, ttlMs = 30_000): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached(key: string, data: any): void {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key: string): void {
  cache.delete(key);
}