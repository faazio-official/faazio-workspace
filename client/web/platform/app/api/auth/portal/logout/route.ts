import { NextResponse, type NextRequest } from "next/server";
import {
  accessCookie,
  callGateway,
  clearAuthCookies,
  portalEnabled,
  refreshCookie,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const access = accessCookie(req);
  const refresh = refreshCookie(req);
  if (portalEnabled()) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (access) headers["Authorization"] = `Bearer ${access}`;
    try {
      await callGateway("/auth/portal/logout", {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      // Local cookies are cleared regardless; the refresh row expires on its own.
    }
  }
  const out = NextResponse.json({ ok: true });
  clearAuthCookies(out);
  return out;
}
