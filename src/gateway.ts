import { cacheKey, classifyCache, readCache, writeCache, type CacheNamespace } from "./cache";
import type { Chain, GatewayResponse, MarketSnapshot } from "./model";
import { fetchProviders } from "./providers";

export interface GatewayDependencies {
  now: () => number;
  resolve: (chain: Chain, address: string) => Promise<MarketSnapshot>;
}

const defaultDependencies: GatewayDependencies = {
  now: () => Date.now(),
  resolve: (chain, address) => fetchProviders(chain, address)
};

export async function resolveThroughGateway(
  env: { MARKET_CACHE: CacheNamespace },
  ctx: Pick<ExecutionContext, "waitUntil">,
  chain: Chain,
  address: string,
  requestId: string,
  dependencies: GatewayDependencies = defaultDependencies
): Promise<GatewayResponse> {
  const key = cacheKey(chain, address);
  const now = dependencies.now();
  const cached = await readCache(env.MARKET_CACHE, key, now);
  const cache = classifyCache(cached, now);

  if (cached && cache.state === "fresh") {
    return { data: cached.snapshot, meta: { requestId, cache: "fresh", ageSeconds: cache.ageSeconds } };
  }

  if (cached && cache.state === "stale") {
    ctx.waitUntil(refresh(env.MARKET_CACHE, key, chain, address, dependencies));
    return { data: cached.snapshot, meta: { requestId, cache: "stale", ageSeconds: cache.ageSeconds } };
  }

  const snapshot = await dependencies.resolve(chain, address);
  await writeCache(env.MARKET_CACHE, key, { snapshot, storedAt: now });
  return { data: snapshot, meta: { requestId, cache: "miss", ageSeconds: 0 } };
}

async function refresh(
  namespace: CacheNamespace,
  key: string,
  chain: Chain,
  address: string,
  dependencies: GatewayDependencies
): Promise<void> {
  try {
    const snapshot = await dependencies.resolve(chain, address);
    await writeCache(namespace, key, { snapshot, storedAt: dependencies.now() });
  } catch (error) {
    console.warn(JSON.stringify({ event: "background_refresh_failed", chain, address, error: String(error) }));
  }
}
