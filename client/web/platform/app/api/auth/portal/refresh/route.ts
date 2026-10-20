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
    const out = NextResponse.json(
      { error: "Session expired.", code: "invalid_refresh" },
      { status: 401 },
    );
    clearAuthCookies(out);
    return out;
  }
  const out = NextResponse.json({ user: result.data.user });
  setAuthCookies(out, result.data.accessToken, result.data.refreshToken);
  return out;
}
