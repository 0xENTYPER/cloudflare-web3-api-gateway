import type { CacheEnvelope, CacheState } from "./model";

export interface CacheNamespace {
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export const FRESH_SECONDS = 30;
export const STALE_SECONDS = 300;
export const HARD_EXPIRY_SECONDS = 900;

export function classifyCache(record: CacheEnvelope | null, nowMs: number): { state: CacheState; ageSeconds: number } {
  if (!record) return { state: "miss", ageSeconds: 0 };

  const ageSeconds = Math.max(0, Math.floor((nowMs - record.storedAt) / 1000));
  if (ageSeconds <= FRESH_SECONDS) return { state: "fresh", ageSeconds };
  if (ageSeconds <= STALE_SECONDS) return { state: "stale", ageSeconds };
  return { state: "miss", ageSeconds };
}

export function cacheKey(chain: string, address: string): string {
  return `market:v1:${chain}:${address.toLowerCase()}`;
}

export async function readCache(namespace: CacheNamespace, key: string, nowMs: number): Promise<CacheEnvelope | null> {
  const record = await namespace.get<CacheEnvelope>(key, "json");
  if (!record) return null;
  if (nowMs - record.storedAt > HARD_EXPIRY_SECONDS * 1000) return null;
  return record;
}

export async function writeCache(namespace: CacheNamespace, key: string, record: CacheEnvelope): Promise<void> {
  await namespace.put(key, JSON.stringify(record), { expirationTtl: HARD_EXPIRY_SECONDS });
}
