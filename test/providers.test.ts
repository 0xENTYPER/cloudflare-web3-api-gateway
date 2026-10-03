import { describe, expect, it } from "vitest";
import { fetchDexScreener, fetchProviders } from "../src/providers";

function reply(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("provider fan-out", () => {
  it("selects the liquid canonical pair and preserves market-cap semantics", async () => {
    const fetcher: typeof fetch = async (input) => String(input).includes("dexscreener")
      ? reply({ pairs: [{
          chainId: "base",
          pairAddress: "deep-pair",
          baseToken: { address: "0x0000000000000000000000000000000000000001", name: "Example", symbol: "EX" },
          quoteToken: { address: "0x0000000000000000000000000000000000000002", name: "USD", symbol: "USD" },
          priceUsd: "1.25",
          liquidity: { usd: 250000 },
          marketCap: 1250000,
          fdv: 2000000,
          info: { imageUrl: "https://example.com/token.png" }
        }] })
      : reply({ data: [{
          id: "thin-pair",
          attributes: { name: "EX / USD", base_token_price_usd: "1.24", reserve_in_usd: "50000", fdv_usd: "1900000" },
          relationships: {
            base_token: { data: { id: "base_0x0000000000000000000000000000000000000001" } },
            quote_token: { data: { id: "base_0x0000000000000000000000000000000000000002" } }
          }
        }] });

    const result = await fetchProviders("base", "0x0000000000000000000000000000000000000001", fetcher);
    expect(result.pairAddress).toBe("deep-pair");
    expect(result.capitalization).toEqual({ kind: "market-cap", usd: 1250000 });
    expect(result.quality).toBe("validated");
    expect(result.providers).toHaveLength(2);
  });

  it("degrades visibly when one provider fails", async () => {
    const fetcher: typeof fetch = async (input) => String(input).includes("dexscreener")
      ? reply({ pairs: [{
          chainId: "base",
          pairAddress: "pair",
          baseToken: { address: "0x0000000000000000000000000000000000000001", name: "Example", symbol: "EX" },
          quoteToken: { address: "0x0000000000000000000000000000000000000002" },
          priceUsd: "1",
          liquidity: { usd: 50000 },
          fdv: 1000000,
          info: {}
        }] })
      : reply({ error: "down" }, 503);

    const result = await fetchProviders("base", "0x0000000000000000000000000000000000000001", fetcher);
    expect(result.quality).toBe("partial");
    expect(result.warnings).toContain("gecko-terminal unavailable");
  });

  it("does not reuse a base-token price for a requested quote token", async () => {
    const fetcher: typeof fetch = async () => reply({ pairs: [{
      chainId: "base",
      pairAddress: "wrong-orientation",
      baseToken: { address: "0x0000000000000000000000000000000000000002", name: "Other", symbol: "OTHER" },
      quoteToken: { address: "0x0000000000000000000000000000000000000001", name: "Example", symbol: "EX" },
      priceUsd: "999",
      liquidity: { usd: 500000 }
    }] });

    await expect(fetchDexScreener("base", "0x0000000000000000000000000000000000000001", fetcher)).resolves.toEqual([]);
  });
});
