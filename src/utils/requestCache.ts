import { getCache, setCache } from "./cache";

type Jsonish = any;

const inFlight = new Map<string, Promise<Jsonish>>();

export type GetOrFetchJsonOptions = {
  /** Unique cache/dedupe key (include plot + date). */
  key: string;
  url: string;
  fetchInit?: RequestInit;
  /** LocalStorage TTL. If omitted, no localStorage read/write is performed. */
  ttlMs?: number;
};

/**
 * Shared request dedupe + cache.
 * - If cached (localStorage) and fresh → returns it
 * - If same request already in-flight → returns the same Promise
 * - Else fetches once, caches, returns JSON
 */
export async function getOrFetchJson({
  key,
  url,
  fetchInit,
  ttlMs,
}: GetOrFetchJsonOptions): Promise<Jsonish> {
  if (ttlMs != null) {
    const cached = getCache(key, ttlMs);
    if (cached != null) return cached;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(url, fetchInit);
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
          `HTTP ${res.status} ${res.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as Jsonish;
      if (ttlMs != null) setCache(key, data);
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}

