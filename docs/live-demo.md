# Live demo contract

The public Worker runs at [`gateway-demo.pnlflex.xyz`](https://gateway-demo.pnlflex.xyz). Values below are abbreviated examples from the deployed service; market values, request IDs, cache ages, and provider availability change over time.

## 1. Service discovery

```bash
curl https://gateway-demo.pnlflex.xyz/
```

```json
{
  "service": "cloudflare-web3-api-gateway",
  "status": "online",
  "endpoints": {
    "health": "/health",
    "token": "/v1/token/:chain/:address"
  },
  "supportedChains": ["ethereum", "base", "bsc", "solana"]
}
```

## 2. Real token with visible provenance

```bash
curl https://gateway-demo.pnlflex.xyz/v1/token/base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

```json
{
  "data": {
    "chain": "base",
    "name": "USD Coin",
    "symbol": "USDC",
    "capitalization": { "kind": "market-cap", "usd": 60903446320 },
    "quality": "partial",
    "providers": ["dex-screener"],
    "warnings": ["gecko-terminal unavailable"]
  },
  "meta": { "cache": "miss", "ageSeconds": 0 }
}
```

This is intentionally not polished into false certainty: one provider succeeded, one did not, and the response says so.

## 3. Cache state is part of the API

Repeated requests expose `fresh`, then `stale`, instead of silently serving an unknown snapshot:

```json
{ "meta": { "cache": "fresh", "ageSeconds": 19 } }
```

After the fresh window, the known snapshot returns immediately while `ctx.waitUntil()` refreshes it:

```json
{ "meta": { "cache": "stale", "ageSeconds": 68 } }
```

## 4. Fail closed when evidence is absent

A structurally valid address that neither provider can resolve returns a request ID and `503`:

```bash
curl -i https://gateway-demo.pnlflex.xyz/v1/token/base/0x0000000000000000000000000000000000000001
```

```json
{ "error": "providers_unavailable", "requestId": "..." }
```

An invalid address never reaches providers:

```json
{ "error": "not_found", "requestId": "..." }
```

## Run every scenario

```bash
npm run demo
```

Set `GATEWAY_URL` to exercise a local or alternate deployment.
