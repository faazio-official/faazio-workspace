import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_GATEWAY_URL, gatewayUrl } from "@/lib/config";

/**
 * The gateway origin decides where a seller enquiry goes. Getting it wrong is silent — the page still
 * renders and the visitor still sees "Enquiry received" — so the precedence is pinned here.
 *
 * `GATEWAY_URL` (server, request time) beats `VITE_GATEWAY_URL` (build-time local fallback) beats the
 * production default. A trailing slash is stripped so `${base}/seller-leads` never doubles up.
 */
describe("gatewayUrl", () => {
  const original = process.env["GATEWAY_URL"];

  afterEach(() => {
    if (original === undefined) delete process.env["GATEWAY_URL"];
    else process.env["GATEWAY_URL"] = original;
  });

  it("defaults to production so an unset env never disables intake", () => {
    delete process.env["GATEWAY_URL"];
    expect(gatewayUrl()).toBe(DEFAULT_GATEWAY_URL);
  });

  it("uses the server GATEWAY_URL when set", () => {
    process.env["GATEWAY_URL"] = "http://localhost:8080";
    expect(gatewayUrl()).toBe("http://localhost:8080");
  });

  it("strips a trailing slash so the path never doubles", () => {
    process.env["GATEWAY_URL"] = "https://api.faazio.com///";
    expect(gatewayUrl()).toBe("https://api.faazio.com");
  });

  it("treats a blank value as unset rather than an empty origin", () => {
    process.env["GATEWAY_URL"] = "   ";
    expect(gatewayUrl()).toBe(DEFAULT_GATEWAY_URL);
  });
});
