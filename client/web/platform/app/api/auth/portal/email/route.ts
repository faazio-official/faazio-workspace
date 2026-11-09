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
  let body: { currentPassword?: unknown; newEmail?: unknown };
  try {
    body = (await req.json()) as { currentPassword?: unknown; newEmail?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "bad_request" }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newEmail = typeof body.newEmail === "string" ? body.newEmail : "";
  if (!currentPassword || !newEmail) {
    return NextResponse.json(
      { error: "Current password and new email are required.", code: "bad_request" },
      { status: 400 },
    );
  }

  let access = accessCookie(req);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  const call = () =>
    callGateway("/auth/portal/email", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ currentPassword, newEmail }),
    });

  // A 401 from the gateway is not always an expired session: a wrong current password is also 401.
  // Only refresh the access token when the failure is an auth-token problem, otherwise surface the
  // real error (and avoid needlessly rotating the refresh token / resending the password).
  const isSessionExpiry = async (response: Response): Promise<boolean> => {
    try {
      const data = (await response.clone().json()) as { code?: unknown };
      return data.code !== "invalid_current_password";
    } catch {
      return true;
    }
  };

  let res: Response;
  try {
    res = await call();
    if (res.status === 401 && (await isSessionExpiry(res))) {
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
      { error: "Email service is unavailable.", code: "gateway_unavailable" },
      { status: 503 },
    );
  }

  if (!res.ok) {
    const data = await readJSON(res);
    const failed = NextResponse.json(data, { status: res.status });
    if (rotated) setAuthCookies(failed, rotated.accessToken, rotated.refreshToken);
    return failed;
  }
  // The login identifier changed: the gateway revoked every refresh session and denylisted the
  // current access token, so clear this browser's cookies and let the client re-authenticate with
  // the new email (same contract as the password route).
  const out = NextResponse.json({ ok: true, email: newEmail });
  clearAuthCookies(out);
  return out;
}