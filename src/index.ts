import { resolveThroughGateway } from "./gateway";
import { corsHeaders, parseTokenRoute, rateLimitKey } from "./security";

function json(body: unknown, status: number, requestId: string, cors: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Request-ID": requestId
    }
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method_not_allowed", requestId }, 405, requestId, cors);
    if (url.pathname === "/health") return json({ status: "ok", environment: env.ENVIRONMENT }, 200, requestId, cors);

    const token = parseTokenRoute(url.pathname);
    if (!token) return json({ error: "not_found", requestId }, 404, requestId, cors);

    const limited = await env.RATE_LIMITER.limit({ key: rateLimitKey(request, "token") });
    if (!limited.success) {
      console.info(JSON.stringify({ event: "rate_limited", requestId, route: "token" }));
      return json({ error: "rate_limited", requestId }, 429, requestId, cors);
    }

    try {
      const result = await resolveThroughGateway(env, ctx, token.chain, token.address, requestId);
      console.info(JSON.stringify({
        event: "gateway_response",
        requestId,
        chain: token.chain,
        cache: result.meta.cache,
        quality: result.data.quality
      }));
      return json(result, 200, requestId, cors);
    } catch (error) {
      console.error(JSON.stringify({ event: "gateway_error", requestId, chain: token.chain, error: String(error) }));
      return json({ error: "providers_unavailable", requestId }, 503, requestId, cors);
    }
  }
} satisfies ExportedHandler<Env>;
