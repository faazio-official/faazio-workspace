import { NextResponse, type NextRequest } from "next/server";
import {
  accessCookie,
  callGateway,
  clearAuthCookies,
  gatewayBase,
  portalEnabled,
  refreshCookie,
  refreshTokens,
  setAuthCookies,
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
  if (!portalEnabled() || !gatewayBase()) {
    return NextResponse.json({ error: "Gateway not configured", code: "offline" }, { status: 503 });
  }
  if (!METHODS.has(req.method)) {
    return NextResponse.json({ error: "Method not allowed", code: "method_not_allowed" }, { status: 405 });
  }
  const { path } = await ctx.params;
  if (!path.length || path.some((segment) => !segment || segment === ".." || segment.includes("/"))) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }
  const target = `/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" ? undefined : await req.arrayBuffer();
  const contentType = req.headers.get("content-type") ?? "";

  let access = accessCookie(req);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  const call = (token: string) => {
    const headers: Record<string, string> = { Accept: "application/json" };
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
      const refreshed = await refreshTokens(refreshCookie(req));
      if (!refreshed.ok || !refreshed.data) {
        const expired = NextResponse.json(
          { error: "Session expired.", code: "invalid_refresh" },
          { status: 401 },
        );
        clearAuthCookies(expired);
        return expired;
      }
      access = refreshed.data.accessToken;
      rotated = {
        accessToken: refreshed.data.accessToken,
        refreshToken: refreshed.data.refreshToken,
      };
      upstream = await call(access);
    }
  } catch {
    return NextResponse.json(
      { error: "Gateway is unavailable.", code: "gateway_unavailable" },
      { status: 503 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
  };
  const nextCursor = upstream.headers.get("x-next-cursor");
  if (nextCursor) headers["X-Next-Cursor"] = nextCursor;

  const out = new NextResponse(upstream.body, { status: upstream.status, headers });
  if (rotated) setAuthCookies(out, rotated.accessToken, rotated.refreshToken);
  return out;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
