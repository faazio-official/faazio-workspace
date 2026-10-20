import { NextResponse, type NextRequest } from "next/server";
import {
  accessCookie,
  callGateway,
  clearAuthCookies,
  portalEnabled,
  readJSON,
  refreshCookie,
  refreshTokens,
  setAuthCookies,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!portalEnabled()) {
    return NextResponse.json({ user: null });
  }
  const access = accessCookie(req);
  if (access) {
    try {
      const res = await callGateway("/auth/portal/me", {
        headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
      });
      if (res.ok) {
        return NextResponse.json({ user: await readJSON(res) });
      }
      if (res.status !== 401) {
        return NextResponse.json({ user: null }, { status: res.status });
      }
    } catch {
      return NextResponse.json({ user: null }, { status: 503 });
    }
  }

  // Access token missing/expired: restore from the HttpOnly refresh cookie.
  const refreshed = await refreshTokens(refreshCookie(req));
  if (!refreshed.ok || !refreshed.data) {
    const out = NextResponse.json({ user: null });
    clearAuthCookies(out);
    return out;
  }
  const out = NextResponse.json({ user: refreshed.data.user });
  setAuthCookies(out, refreshed.data.accessToken, refreshed.data.refreshToken);
  return out;
}
