import { NextResponse, type NextRequest } from "next/server";
import {
  accessCookie,
  callGateway,
  clearAuthCookies,
  failJSON,
  gatewayBase,
  ipHash8,
  logRoute,
  portalEnabled,
  refreshCookie,
  refreshTokens,
  requestID,
  setAuthCookies,
  withRequestID,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Same-origin gateway proxy for portal mode. The browser never receives the bearer token: it lives
 * in an HttpOnly cookie that this handler reads, so an XSS payload cannot exfiltrate it. A 401 is
 * retried once after rotating the refresh token.
 */
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const id = requestID(req);
  const started = Date.now();
  const ip = ipHash8(req);
  const log = (code: string, upstreamStatus: number) =>
    logRoute({
      id,
      path: "/api/gateway",
      upstreamStatus,
      code,
      latencyMs: Date.now() - started,
      ipHash8: ip,
    });

  if (!portalEnabled() || !gatewayBase()) {
    log("offline", 0);
    return withRequestID(failJSON(503, "offline", "Gateway not configured", id), id);
  }
  if (!METHODS.has(req.method)) {
    log("method_not_allowed", 0);
    return withRequestID(failJSON(405, "method_not_allowed", "Method not allowed", id), id);
  }
  const { path } = await ctx.params;
  if (!path.length || path.some((segment) => !segment || segment === ".." || segment.includes("/"))) {
    log("not_found", 0);
    return withRequestID(failJSON(404, "not_found", "Not found", id), id);
  }
  const target = `/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" ? undefined : await req.arrayBuffer();
  const contentType = req.headers.get("content-type") ?? "";

  let access = accessCookie(req);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  const call = (token: string) => {
    const headers: Record<string, string> = { Accept: "application/json", "X-Request-Id": id };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (contentType) headers["Content-Type"] = contentType;
    const init: RequestInit = { method: req.method, headers };
    if (body && body.byteLength > 0) init.body = body;
    return callGateway(target, init);
  };

  let upstream: Response;
  try {
    upstream = await call(access);
    if (upstream.status === 401) {
      const refreshed = await refreshTokens(refreshCookie(req), id);
      if (!refreshed.ok || !refreshed.data) {
        if (!refreshed.terminal) {
          // Transient (gateway blip / timeout): keep the long-lived refresh cookie and surface a
          // retryable 503 so the client can retry instead of being logged out.
          log(refreshed.code ?? "gateway_unavailable", 503);
          return withRequestID(
            failJSON(503, "gateway_unavailable", "Gateway is unavailable.", id),
            id,
          );
        }
        const code = refreshed.code ?? "invalid_refresh";
        log(code, 401);
        const expired = failJSON(401, code, "Session expired.", id);
        clearAuthCookies(expired);
        return withRequestID(expired, id);
      }
      access = refreshed.data.accessToken;
      rotated = {
        accessToken: refreshed.data.accessToken,
        refreshToken: refreshed.data.refreshToken,
      };
      upstream = await call(access);
    }
  } catch {
    log("gateway_unavailable", 0);
    return withRequestID(
      failJSON(503, "gateway_unavailable", "Gateway is unavailable.", id),
      id,
    );
  }
  log(upstream.ok ? "ok" : "upstream_error", upstream.status);

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
  };
  const nextCursor = upstream.headers.get("x-next-cursor");
  if (nextCursor) headers["X-Next-Cursor"] = nextCursor;

  const out = new NextResponse(upstream.body, { status: upstream.status, headers });
  if (rotated) setAuthCookies(out, rotated.accessToken, rotated.refreshToken);
  return withRequestID(out, id);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;