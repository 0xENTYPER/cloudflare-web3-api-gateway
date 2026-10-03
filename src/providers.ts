import type { Chain, MarketCandidate, MarketSnapshot, ProviderName } from "./model";

type JsonRecord = Record<string, unknown>;

const GECKO_NETWORKS: Record<Chain, string> = {
  ethereum: "eth",
  base: "base",
  bsc: "bsc",
  solana: "solana"
};

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null ? value as JsonRecord : null;
}

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function capitalization(marketCap: unknown, fdv: unknown) {
  const marketCapUsd = finite(marketCap);
  if (marketCapUsd !== null) return { kind: "market-cap" as const, usd: marketCapUsd };
  const fdvUsd = finite(fdv);
  return fdvUsd === null ? null : { kind: "fdv" as const, usd: fdvUsd };
}

export async function fetchDexScreener(chain: Chain, address: string, fetcher: typeof fetch): Promise<MarketCandidate[]> {
  const response = await fetcher(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`dex-screener:${response.status}`);

  const body = record(await response.json());
  const pairs = Array.isArray(body?.pairs) ? body.pairs : [];
  const candidates: MarketCandidate[] = [];

  for (const raw of pairs) {
    const pair = record(raw);
    const baseToken = record(pair?.baseToken);
    const quoteToken = record(pair?.quoteToken);
    const info = record(pair?.info);
    const priceUsd = finite(pair?.priceUsd);
    const liquidityUsd = finite(record(pair?.liquidity)?.usd);
    const baseAddress = text(baseToken?.address);
    const tokenIsBase = baseAddress?.toLowerCase() === address.toLowerCase();
    const token = tokenIsBase ? baseToken : null;

    if (pair?.chainId !== chain || !token || priceUsd === null || liquidityUsd === null) continue;
    const images = Array.isArray(info?.imageUrl) ? info.imageUrl : null;
    candidates.push({
      provider: "dex-screener",
      chain,
      address,
      pairAddress: text(pair?.pairAddress) ?? "unknown",
      name: text(token.name),
      symbol: text(token.symbol),
      imageUrl: text(info?.imageUrl) ?? (images ? text(images[0]) : null),
      priceUsd,
      liquidityUsd,
      capitalization: capitalization(pair?.marketCap, pair?.fdv)
    });
  }

  return candidates;
}

export async function fetchGeckoTerminal(chain: Chain, address: string, fetcher: typeof fetch): Promise<MarketCandidate[]> {
  const network = GECKO_NETWORKS[chain];
  const response = await fetcher(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${encodeURIComponent(address)}/pools?page=1`, {
    headers: { Accept: "application/json;version=20230302" }
  });
  if (!response.ok) throw new Error(`gecko-terminal:${response.status}`);

  const body = record(await response.json());
  const pools = Array.isArray(body?.data) ? body.data : [];
  const candidates: MarketCandidate[] = [];

  for (const raw of pools) {
    const item = record(raw);
    const attributes = record(item?.attributes);
    const relationships = record(item?.relationships);
    const baseToken = record(record(relationships?.base_token)?.data);
    const quoteToken = record(record(relationships?.quote_token)?.data);
    const normalizedAddress = address.toLowerCase();
    const tokenIsBase = text(baseToken?.id)?.toLowerCase().endsWith(normalizedAddress) ?? false;
    const tokenIsQuote = text(quoteToken?.id)?.toLowerCase().endsWith(normalizedAddress) ?? false;
    const priceUsd = finite(tokenIsBase ? attributes?.base_token_price_usd : tokenIsQuote ? attributes?.quote_token_price_usd : null);
    const liquidityUsd = finite(attributes?.reserve_in_usd);
    if ((!tokenIsBase && !tokenIsQuote) || priceUsd === null || liquidityUsd === null) continue;

    candidates.push({
      provider: "gecko-terminal",
      chain,
      address,
      pairAddress: text(item?.id) ?? "unknown",
      name: text(attributes?.name),
      symbol: null,
      imageUrl: null,
      priceUsd,
      liquidityUsd,
      capitalization: tokenIsBase ? capitalization(attributes?.market_cap_usd, attributes?.fdv_usd) : null
    });
  }

  return candidates;
}

export async function fetchProviders(chain: Chain, address: string, fetcher: typeof fetch = fetch): Promise<MarketSnapshot> {
  const outcomes = await Promise.allSettled([
    fetchDexScreener(chain, address, fetcher),
    fetchGeckoTerminal(chain, address, fetcher)
  ]);

  const candidates = outcomes.flatMap((outcome) => outcome.status === "fulfilled" ? outcome.value : []);
  if (candidates.length === 0) throw new Error("providers_unavailable");

  candidates.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
  const selected = candidates[0];
  if (!selected) throw new Error("providers_unavailable");

  const providers = [...new Set(candidates.map((candidate) => candidate.provider))] as ProviderName[];
  const warnings = outcomes.flatMap((outcome, index) => outcome.status === "rejected"
    ? [`${index === 0 ? "dex-screener" : "gecko-terminal"} unavailable`]
    : []);
  const quality = providers.length > 1 && selected.liquidityUsd >= 100_000
    ? "validated"
    : selected.liquidityUsd >= 10_000 ? "partial" : "degraded";

  return {
    chain,
    address,
    pairAddress: selected.pairAddress,
    name: selected.name,
    symbol: selected.symbol,
    imageUrl: selected.imageUrl,
    priceUsd: selected.priceUsd,
    liquidityUsd: selected.liquidityUsd,
    capitalization: selected.capitalization,
    quality,
    providers,
    warnings,
    observedAt: new Date().toISOString()
  };
}
