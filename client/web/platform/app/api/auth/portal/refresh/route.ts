import { NextResponse, type NextRequest } from "next/server";
import {
  clearAuthCookies,
  portalEnabled,
  refreshCookie,
  refreshTokens,
  setAuthCookies,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!portalEnabled()) {
    return NextResponse.json({ error: "Portal auth is disabled.", code: "disabled" }, { status: 503 });
  }
  const result = await refreshTokens(refreshCookie(req));
  if (!result.ok || !result.data) {
    if (!result.terminal) {
      // Transient (gateway blip / timeout): the refresh cookie is still valid — keep it.
      return NextResponse.json(
        { error: "Gateway is unavailable.", code: result.code ?? "gateway_unavailable", terminal: false },
        { status: 503 },
      );
    }
    const out = NextResponse.json(
      { error: "Session expired.", code: result.code ?? "invalid_refresh", terminal: true },
      { status: 401 },
    );
    clearAuthCookies(out);
    return out;
  }
  const out = NextResponse.json({ user: result.data.user });
  setAuthCookies(out, result.data.accessToken, result.data.refreshToken);
  return out;
}
