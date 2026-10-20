import { NextResponse, type NextRequest } from "next/server";
import {
  accessCookie,
  callGateway,
  clearAuthCookies,
  failJSON,
  ipHash8,
  logRoute,
  portalEnabled,
  readJSON,
  requestID,
  refreshCookie,
  refreshTokens,
  setAuthCookies,
  withRequestID,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = requestID(req);
  const started = Date.now();
  const ip = ipHash8(req);
  const log = (code: string, upstreamStatus: number) =>
    logRoute({
      id,
      path: "/api/auth/portal/me",
      upstreamStatus,
      code,
      latencyMs: Date.now() - started,
      ipHash8: ip,
    });

  if (!portalEnabled()) {
    log("not_configured", 0);
    return withRequestID(NextResponse.json({ user: null, requestId: id }), id);
  }
  const access = accessCookie(req);
  if (access) {
    try {
      const res = await callGateway("/auth/portal/me", {
        headers: {
          Authorization: `Bearer ${access}`,
          Accept: "application/json",
          "X-Request-Id": id,
        },
      });
      if (res.ok) {
        log("ok", res.status);
        return withRequestID(
          NextResponse.json({ user: await readJSON(res), requestId: id }),
          id,
        );
      }
      if (res.status !== 401) {
        log("upstream_error", res.status);
        return withRequestID(
          NextResponse.json({ user: null }, { status: res.status }),
          id,
        );
      }
    } catch {
      log("gateway_unavailable", 0);
      return withRequestID(failJSON(503, "gateway_unavailable", "Gateway is unavailable.", id), id);
    }
  }

  // Access token missing/expired: restore from the HttpOnly refresh cookie.
  const refreshed = await refreshTokens(refreshCookie(req), id);
  if (!refreshed.ok || !refreshed.data) {
    log("invalid_refresh", 0);
    const out = NextResponse.json({ user: null });
    clearAuthCookies(out);
    return withRequestID(out, id);
  }
  log("refreshed", 200);
  const out = NextResponse.json({ user: refreshed.data.user, requestId: id });
  setAuthCookies(out, refreshed.data.accessToken, refreshed.data.refreshToken);
  return withRequestID(out, id);
}