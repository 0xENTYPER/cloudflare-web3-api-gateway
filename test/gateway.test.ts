import { describe, expect, it, vi } from "vitest";
import type { CacheNamespace } from "../src/cache";
import { resolveThroughGateway } from "../src/gateway";
import type { CacheEnvelope, MarketSnapshot } from "../src/model";

const snapshot: MarketSnapshot = {
  chain: "base",
  address: "0x0000000000000000000000000000000000000001",
  pairAddress: "pair",
  name: "Example",
  symbol: "EX",
  imageUrl: null,
  priceUsd: 1,
  liquidityUsd: 200_000,
  capitalization: { kind: "market-cap", usd: 1_000_000 },
  quality: "validated",
  providers: ["dex-screener", "gecko-terminal"],
  warnings: [],
  observedAt: "2026-10-03T00:00:00.000Z"
};

function namespace(record: CacheEnvelope | null) {
  const writes: string[] = [];
  const store: CacheNamespace = {
    get: async <T>() => record as T | null,
    put: async (_key, value) => { writes.push(value); }
  };
  return { store, writes };
}

describe("resolveThroughGateway", () => {
  it("returns stale data immediately and attaches refresh to the execution context", async () => {
    const now = 400_000;
    const cache = namespace({ snapshot, storedAt: 200_000 });
    const background: Promise<unknown>[] = [];
    const resolve = vi.fn(async () => ({ ...snapshot, priceUsd: 2 }));

    const result = await resolveThroughGateway(
      { MARKET_CACHE: cache.store },
      { waitUntil: (promise) => { background.push(promise); } },
      "base",
      snapshot.address,
      "req-1",
      { now: () => now, resolve }
    );

    expect(result.meta.cache).toBe("stale");
    expect(result.data.priceUsd).toBe(1);
    expect(background).toHaveLength(1);
    await Promise.all(background);
    expect(resolve).toHaveBeenCalledOnce();
    expect(cache.writes).toHaveLength(1);
  });

  it("awaits providers and writes through on a cache miss", async () => {
    const cache = namespace(null);
    const result = await resolveThroughGateway(
      { MARKET_CACHE: cache.store },
      { waitUntil: vi.fn() },
      "base",
      snapshot.address,
      "req-2",
      { now: () => 1_000, resolve: async () => snapshot }
    );

    expect(result.meta.cache).toBe("miss");
    expect(cache.writes).toHaveLength(1);
  });
});
