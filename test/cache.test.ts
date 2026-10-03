import { describe, expect, it } from "vitest";
import { classifyCache, FRESH_SECONDS, STALE_SECONDS } from "../src/cache";
import type { CacheEnvelope } from "../src/model";

const record = (storedAt: number): CacheEnvelope => ({
  storedAt,
  snapshot: {
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
  }
});

describe("classifyCache", () => {
  it("keeps the fresh boundary inclusive", () => {
    expect(classifyCache(record(0), FRESH_SECONDS * 1000)).toEqual({ state: "fresh", ageSeconds: FRESH_SECONDS });
  });

  it("returns stale inside the fallback window", () => {
    expect(classifyCache(record(0), (FRESH_SECONDS + 1) * 1000).state).toBe("stale");
  });

  it("turns records beyond the stale window into misses", () => {
    expect(classifyCache(record(0), (STALE_SECONDS + 1) * 1000).state).toBe("miss");
  });
});
