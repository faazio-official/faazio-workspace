import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_MAX_AGE,
  clearAuthCookies,
  portalEnabled,
  refreshCookie,
  refreshTokensSingleflight,
  rememberPersisted,
  requestID,
  setAuthCookies,
  withRequestID,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = requestID(req);
  if (!portalEnabled()) {
    return NextResponse.json({ error: "Portal auth is disabled.", code: "disabled" }, { status: 503 });
  }
  // This is the proactive keep-alive endpoint (P3.2): a silent refresh at ~80% of access life, on
  // tab focus, and on every 401. Single-flight so N concurrent triggers share one gateway rotation.
  const result = await refreshTokensSingleflight(refreshCookie(req), id);
  if (!result.ok || !result.data) {
    if (!result.terminal) {
      // Transient (gateway blip / timeout): the refresh cookie is still valid — keep it.
      return withRequestID(
        NextResponse.json(
          { error: "Gateway is unavailable.", code: result.code ?? "gateway_unavailable", terminal: false },
          { status: 503 },
        ),
        id,
      );
    }
    const out = NextResponse.json(
      { error: "Session expired.", code: result.code ?? "invalid_refresh", terminal: true },
      { status: 401 },
    );
    clearAuthCookies(out);
    return withRequestID(out, id);
  }
  const out = NextResponse.json({
    user: result.data.user,
    expiresIn: result.data.expiresIn ?? ACCESS_MAX_AGE,
    requestId: id,
  });
  setAuthCookies(out, result.data.accessToken, result.data.refreshToken, rememberPersisted(req));
  return withRequestID(out, id);
}
