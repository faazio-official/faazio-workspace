import { NextResponse, type NextRequest } from "next/server";
import {
  callGateway,
  failJSON,
  gatewayBase,
  ipHash8,
  logRoute,
  portalEnabled,
  readJSON,
  requestID,
  setAuthCookies,
  withRequestID,
  type PortalTokenPayload,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = requestID(req);
  const started = Date.now();
  const ip = ipHash8(req);

  const done = (res: NextResponse, code: string, upstreamStatus: number) => {
    logRoute({
      id,
      path: "/api/auth/portal/login",
      upstreamStatus,
      code,
      latencyMs: Date.now() - started,
      ipHash8: ip,
    });
    return withRequestID(res, id);
  };

  if (!portalEnabled() || !gatewayBase()) {
    return done(
      NextResponse.json(
        { error: "Portal auth is not configured.", code: "not_configured", requestId: id },
        { status: 503 },
      ),
      "not_configured",
      0,
    );
  }
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return done(failJSON(400, "bad_request", "Invalid request body.", id), "bad_request", 400);
  }
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return done(
      failJSON(400, "bad_request", "Email and password are required.", id),
      "bad_request",
      400,
    );
  }

  let res: Response;
  try {
    res = await callGateway("/auth/portal/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": id,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return done(
      failJSON(503, "gateway_unavailable", "Sign-in service is unavailable.", id),
      "gateway_unavailable",
      0,
    );
  }
  const data = await readJSON(res);
  if (!res.ok) {
    const code = typeof data["code"] === "string" ? data["code"] : "upstream_error";
    return done(
      NextResponse.json({ ...data, requestId: id }, { status: res.status }),
      code,
      res.status,
    );
  }
  const token = data as unknown as PortalTokenPayload;
  if (!token.accessToken || !token.refreshToken || !token.user) {
    return done(
      failJSON(502, "bad_gateway_response", "Sign-in service returned an invalid session.", id),
      "bad_gateway_response",
      res.status,
    );
  }
  const out = NextResponse.json({ user: token.user, requestId: id });
  setAuthCookies(out, token.accessToken, token.refreshToken);
  return done(out, "ok", res.status);
}