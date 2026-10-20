import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_MAX_AGE,
  accessCookie,
  callGateway,
  clearAuthCookies,
  failJSON,
  ipHash8,
  logRoute,
  portalEnabled,
  readJSON,
  rememberPersisted,
  requestID,
  refreshCookie,
  refreshTokensSingleflight,
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
          NextResponse.json({
            user: await readJSON(res),
            // The client only needs a floor for its keep-alive timer; the access token is 15 min.
            expiresIn: ACCESS_MAX_AGE,
            requestId: id,
          }),
          id,
        );
      }
      if (res.status !== 401) {
        log("upstream_error", res.status);
        const upstream = await readJSON(res);
        const code =
          typeof upstream["code"] === "string" ? upstream["code"] : "upstream_error";
        // Non-auth upstream errors are transient: keep the cookies, never force logout.
        return withRequestID(
          NextResponse.json({ user: null, code, terminal: false }, { status: res.status }),
          id,
        );
      }
    } catch {
      log("gateway_unavailable", 0);
      return withRequestID(failJSON(503, "gateway_unavailable", "Gateway is unavailable.", id), id);
    }
  }

  // Access token missing/expired: restore from the HttpOnly refresh cookie. Concurrent cold-start
  // restores with the same cookie share ONE gateway rotation (single-flight).
  const refreshed = await refreshTokensSingleflight(refreshCookie(req), id);
  if (!refreshed.ok || !refreshed.data) {
    const code = refreshed.code ?? "invalid_refresh";
    if (!refreshed.terminal) {
      // Transient (gateway blip / timeout / 5xx): the refresh cookie is still valid. Keep it and
      // tell the client to retry — one Cloudflare hiccup must not delete a 30-day-idle session.
      log(code, 503);
      return withRequestID(
        NextResponse.json({ user: null, code, terminal: false }, { status: 503 }),
        id,
      );
    }
    log(code, 0);
    const out = NextResponse.json({ user: null, code, terminal: true });
    clearAuthCookies(out);
    return withRequestID(out, id);
  }
  log("refreshed", 200);
  const out = NextResponse.json({
    user: refreshed.data.user,
    expiresIn: refreshed.data.expiresIn ?? ACCESS_MAX_AGE,
    requestId: id,
  });
  // Preserve the "Stay signed in" choice across a silent rotation (remember = session-only cookie).
  setAuthCookies(out, refreshed.data.accessToken, refreshed.data.refreshToken, rememberPersisted(req));
  return withRequestID(out, id);
}