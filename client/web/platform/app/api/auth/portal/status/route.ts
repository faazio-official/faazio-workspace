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
  withRequestID,
} from "@/lib/portal/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort per-instance limiter; Cloudflare's edge WAF is the authoritative throttle. The probe
// sends an empty body, so it never consumes the gateway's per-IP/per-email login counters.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { n: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.n += 1;
  return entry.n > MAX_PER_WINDOW;
}

type GatewayAuth = "ok" | "portal_auth_unavailable" | "unreachable";

/** Unauthenticated diagnostic: joins Vercel's build-time env with Render's runtime env in one call. */
export async function GET(req: NextRequest) {
  const id = requestID(req);
  const ip = ipHash8(req);
  if (rateLimited(ip)) {
    logRoute({ id, path: "/api/auth/portal/status", upstreamStatus: 0, code: "rate_limited", ipHash8: ip });
    return withRequestID(failJSON(429, "rate_limited", "Too many status checks.", id), id);
  }

  const base = gatewayBase();
  let host = "";
  try {
    host = base ? new URL(base).host : "";
  } catch {
    host = "";
  }

  const enabled = portalEnabled() && base !== "";
  let reachable = false;
  let auth: GatewayAuth = "unreachable";

  if (enabled) {
    try {
      const health = await callGateway("/health", {
        headers: { Accept: "application/json", "X-Request-Id": id },
        signal: AbortSignal.timeout(3500),
      });
      reachable = health.ok;
      if (reachable) {
        const probe = await callGateway("/auth/portal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", "X-Request-Id": id },
          body: "{}",
          signal: AbortSignal.timeout(3500),
        });
        const data = await readJSON(probe);
        const code = typeof data["code"] === "string" ? data["code"] : "";
        auth =
          probe.status === 503 && code === "portal_auth_unavailable"
            ? "portal_auth_unavailable"
            : "ok";
      }
    } catch {
      reachable = false;
      auth = "unreachable";
    }
  }

  logRoute({
    id,
    path: "/api/auth/portal/status",
    upstreamStatus: 200,
    code: auth,
    ipHash8: ip,
  });

  return withRequestID(
    NextResponse.json(
      {
        portalEnabled: enabled,
        gatewayBaseHost: host,
        gatewayReachable: reachable,
        gatewayAuth: auth,
        checkedAt: new Date().toISOString(),
        requestId: id,
      },
      { headers: { "Cache-Control": "no-store" } },
    ),
    id,
  );
}