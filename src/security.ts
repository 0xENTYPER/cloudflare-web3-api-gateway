import { CHAINS, type Chain } from "./model";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseTokenRoute(pathname: string): { chain: Chain; address: string } | null {
  const match = /^\/v1\/token\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  const chain = match[1];
  const address = match[2];
  if (!chain || !address || !CHAINS.includes(chain as Chain)) return null;

  const valid = chain === "solana" ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address);
  return valid ? { chain: chain as Chain, address } : null;
}

export function corsHeaders(origin: string | null, configured: string): HeadersInit {
  const allowed = configured.split(",").map((item) => item.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
}

export function rateLimitKey(request: Request, route: string): string {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return `${route}:${ip}`;
}
