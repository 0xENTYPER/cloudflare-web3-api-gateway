import { describe, expect, it } from "vitest";
import { corsHeaders, parseTokenRoute, rateLimitKey } from "../src/security";

describe("gateway security helpers", () => {
  it("accepts a valid EVM route", () => {
    expect(parseTokenRoute("/v1/token/base/0x0000000000000000000000000000000000000001")?.chain).toBe("base");
  });

  it("rejects malformed and unsupported addresses", () => {
    expect(parseTokenRoute("/v1/token/base/0x1234")).toBeNull();
    expect(parseTokenRoute("/v1/token/unknown/0x0000000000000000000000000000000000000001")).toBeNull();
  });

  it("reflects only configured origins", () => {
    expect(corsHeaders("https://app.example", "https://app.example")).toMatchObject({
      "Access-Control-Allow-Origin": "https://app.example"
    });
    expect(corsHeaders("https://evil.example", "https://app.example")).not.toHaveProperty("Access-Control-Allow-Origin");
  });

  it("scopes rate-limit keys by route and edge-provided IP", () => {
    const request = new Request("https://api.example/v1/token/base/test", {
      headers: { "CF-Connecting-IP": "203.0.113.10" }
    });
    expect(rateLimitKey(request, "token")).toBe("token:203.0.113.10");
  });
});
