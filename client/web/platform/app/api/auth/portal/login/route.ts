import { NextResponse, type NextRequest } from "next/server";
import {
  callGateway,
  gatewayBase,
  portalEnabled,
  readJSON,
  setAuthCookies,
  type PortalTokenPayload,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!portalEnabled() || !gatewayBase()) {
    return NextResponse.json(
      { error: "Portal auth is not configured.", code: "not_configured" },
      { status: 503 },
    );
  }
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body.", code: "bad_request" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required.", code: "bad_request" },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await callGateway("/auth/portal/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return NextResponse.json(
      { error: "Sign-in service is unavailable.", code: "gateway_unavailable" },
      { status: 503 },
    );
  }
  const data = await readJSON(res);
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  const token = data as unknown as PortalTokenPayload;
  if (!token.accessToken || !token.refreshToken || !token.user) {
    return NextResponse.json(
      { error: "Sign-in service returned an invalid session.", code: "bad_gateway_response" },
      { status: 502 },
    );
  }
  const out = NextResponse.json({ user: token.user });
  setAuthCookies(out, token.accessToken, token.refreshToken);
  return out;
}
