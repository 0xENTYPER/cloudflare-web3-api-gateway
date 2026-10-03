export const CHAINS = ["ethereum", "base", "bsc", "solana"] as const;

export type Chain = (typeof CHAINS)[number];
export type ProviderName = "dex-screener" | "gecko-terminal";
export type Quality = "validated" | "partial" | "degraded";
export type CacheState = "fresh" | "stale" | "miss";

export interface Capitalization {
  kind: "market-cap" | "fdv";
  usd: number;
}

export interface MarketCandidate {
  provider: ProviderName;
  chain: Chain;
  address: string;
  pairAddress: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number;
  liquidityUsd: number;
  capitalization: Capitalization | null;
}

export interface MarketSnapshot {
  chain: Chain;
  address: string;
  pairAddress: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number;
  liquidityUsd: number;
  capitalization: Capitalization | null;
  quality: Quality;
  providers: ProviderName[];
  warnings: string[];
  observedAt: string;
}

export interface CacheEnvelope {
  snapshot: MarketSnapshot;
  storedAt: number;
}

export interface GatewayResponse {
  data: MarketSnapshot;
  meta: {
    requestId: string;
    cache: CacheState;
    ageSeconds: number;
  };
}
