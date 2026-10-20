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

export async function PUT(req: NextRequest) {
  if (!portalEnabled()) {
    return NextResponse.json({ error: "Portal auth is disabled.", code: "disabled" }, { status: 503 });
  }
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await req.json()) as { currentPassword?: unknown; newPassword?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "bad_request" }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new passwords are required.", code: "bad_request" },
      { status: 400 },
    );
  }

  const out = NextResponse.json({ ok: true });
  let access = accessCookie(req);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  const call = () =>
    callGateway("/auth/portal/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

  let res: Response;
  try {
    res = await call();
    if (res.status === 401) {
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
      res = await call();
    }
  } catch {
    return NextResponse.json(
      { error: "Password service is unavailable.", code: "gateway_unavailable" },
      { status: 503 },
    );
  }

  if (!res.ok) {
    const data = await readJSON(res);
    const failed = NextResponse.json(data, { status: res.status });
    if (rotated) setAuthCookies(failed, rotated.accessToken, rotated.refreshToken);
    return failed;
  }
  // Password change revokes every refresh session server-side and denylists the current access
  // token; clear this browser's cookies so the user signs in again with the new password.
  clearAuthCookies(out);
  return out;
}
