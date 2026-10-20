// Server-only helpers for the gateway-native portal session. Tokens live in HttpOnly cookies set
// by these route handlers — never in localStorage — and every gateway call is proxied same-origin so
// the browser never holds a bearer token that XSS could read.
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ACCESS_COOKIE = "faazio_pat";
export const REFRESH_COOKIE = "faazio_prt";
export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;
/**
 * Marks the GCP-style "don't stay signed in on this shared computer" decision. Absent / "1" →
 * persistent 30-day refresh cookie; "0" → the refresh cookie is browser-session-only (still 30-day
 * idle server-side, but forgotten when the tab/window closes). Kept separate from the tokens so the
 * HttpOnly invariant never weakens for a preference.
 */
export const REMEMBER_COOKIE = "faazio_remember";

export interface PortalUserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  mustChange: boolean;
}

export interface PortalTokenPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: PortalUserPayload;
}

/** Gateway origin without a trailing slash. */
export function gatewayBase(): string {
  return process.env["NEXT_PUBLIC_GATEWAY_URL"]?.replace(/\/+$/, "") ?? "";
}

function cookieOptions(maxAge: number, persist: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // A non-persistent cookie has no Max-Age/Expires, so the browser drops it on close (the
    // GCP "stay signed in" checkbox off). The access cookie is always short-lived anyway.
    ...(persist ? { maxAge } : {}),
  };
}

export function setAuthCookies(
  res: NextResponse,
  accessToken?: string | undefined,
  refreshToken?: string | undefined,
  persist = true,
): void {
  if (accessToken) res.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE, true));
  if (refreshToken) res.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE, persist));
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", cookieOptions(0, true));
  res.cookies.set(REFRESH_COOKIE, "", cookieOptions(0, true));
  res.cookies.set(REMEMBER_COOKIE, "", cookieOptions(0, true));
}

/** True unless the user explicitly un-checked "Stay signed in" (cookie value is "0"). */
export function rememberPersisted(req: NextRequest): boolean {
  return req.cookies.get(REMEMBER_COOKIE)?.value !== "0";
}

export function setRememberCookie(res: NextResponse, remember: boolean): void {
  // The flag is only read server-side (rememberPersisted), so HttpOnly is fine — it is a
  // preference, never a secret.
  if (remember) {
    res.cookies.set(REMEMBER_COOKIE, "", cookieOptions(0, true));
  } else {
    res.cookies.set(REMEMBER_COOKIE, "0", cookieOptions(REFRESH_MAX_AGE, true));
  }
}

export function accessCookie(req: NextRequest): string {
  return req.cookies.get(ACCESS_COOKIE)?.value ?? "";
}

export function refreshCookie(req: NextRequest): string {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? "";
}

/** True when the gateway origin is configured (portal auth is the only auth mode). */
export function portalEnabled(): boolean {
  return gatewayBase().length > 0;
}

export async function callGateway(path: string, init: RequestInit = {}): Promise<Response> {
  const base = gatewayBase();
  if (!base) throw new Error("gateway_not_configured");
  return fetch(`${base}${path}`, { ...init, cache: "no-store" });
}

export async function readJSON(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Request id for correlation: reuse the inbound id (or a fresh UUID) and echo it to the client. */
export function requestID(req: NextRequest): string {
  const inbound = req.headers.get("x-request-id")?.trim();
  return inbound && inbound.length <= 128 ? inbound : randomUUID();
}

/** Short, non-reversible client-IP hash for logs (never the raw IP; AGENTS.md PII rule). */
export function ipHash8(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = req.headers.get("cf-connecting-ip")?.trim() || fwd || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 8);
}

/** One structured JSON log line per route call — no bodies, secrets or PII. */
export function logRoute(fields: Record<string, string | number | boolean>): void {
  console.log(JSON.stringify({ at: "portal-route", ...fields }));
}

export function withRequestID<T extends NextResponse>(res: T, id: string): T {
  res.headers.set("X-Request-Id", id);
  return res;
}

export function failJSON(
  status: number,
  code: string,
  message: string,
  id: string,
): NextResponse {
  const res = NextResponse.json({ error: message, code, requestId: id }, { status });
  return withRequestID(res, id);
}

export interface RefreshResult {
  ok: boolean;
  data: PortalTokenPayload | null;
  /**
   * true only when the refresh is genuinely dead (gateway 401 invalid_refresh / 400) — callers must
   * clear the cookies. false on network / timeout / 5xx / malformed: the long-lived refresh cookie
   * is still valid, so callers must keep it and treat the failure as transient.
   */
  terminal: boolean;
  /** gateway error code when present (e.g. invalid_refresh, session_expired_idle). */
  code: string | undefined;
}

/** A gateway cold-start / Cloudflare blip must never delete a valid 30-day-idle session, so a refresh
 *  call that cannot be answered is transient — never terminal. */
const REFRESH_TIMEOUT_MS = 5000;

/** Rotates the opaque refresh token through the gateway, classifying failures (see RefreshResult). */
export async function refreshTokens(refreshToken: string, reqId = ""): Promise<RefreshResult> {
  if (!refreshToken) {
    // No cookie = nothing to keep: report terminal so routes clear (a no-op) and the client lands
    // on the sign-in gate instead of a "Reconnecting…" retry loop for a brand-new visitor.
    return { ok: false, data: null, terminal: true, code: "no_refresh_token" };
  }
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    res = await callGateway("/auth/portal/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(reqId ? { "X-Request-Id": reqId } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, data: null, terminal: false, code: "gateway_unavailable" };
  } finally {
    clearTimeout(timer);
  }
  const data = await readJSON(res);
  if (res.ok) {
    const token = data as unknown as PortalTokenPayload;
    if (!token.accessToken || !token.refreshToken) {
      return { ok: false, data: null, terminal: false, code: "bad_gateway_response" };
    }
    return { ok: true, data: token, terminal: false, code: undefined };
  }
  const code = typeof data["code"] === "string" ? data["code"] : undefined;
  if (res.status === 401 || res.status === 400) {
    return { ok: false, data: null, terminal: true, code };
  }
  return { ok: false, data: null, terminal: false, code };
}

/**
 * Server-side single-flight rotation (P3.1): N concurrent request handlers that hit a 401 with the
 * same refresh cookie coalesce onto ONE upstream /auth/portal/refresh. This removes the rotation
 * race from the Next layer entirely — and even with the gateway's 30 s reuse-grace (0038), fewer
 * rotations means fewer rows and less DB/Valkey churn. Keyed by a 16-hex sha256 of the token (never
 * the raw token); the winner's in-flight promise is shared and the entry is dropped on settle.
 */
const singleFlight = new Map<string, Promise<RefreshResult>>();
const SINGLE_FLIGHT_TTL_MS = 10_000;

export function refreshTokensSingleflight(refreshToken: string, reqId = ""): Promise<RefreshResult> {
  if (!refreshToken) return refreshTokens("", reqId);
  const key = createHash("sha256").update(refreshToken).digest("hex").slice(0, 16);
  const inflight = singleFlight.get(key);
  if (inflight) return inflight;
  const promise = refreshTokens(refreshToken, reqId);
  singleFlight.set(key, promise);
  const ttl = setTimeout(() => {
    // Fallback sweep: drop the entry even if settle was missed. refreshTokens already aborts at 5 s,
    // so this only fires on an edge the AbortSignal cannot see.
    if (singleFlight.get(key) === promise) singleFlight.delete(key);
  }, SINGLE_FLIGHT_TTL_MS);
  void promise.finally(() => {
    clearTimeout(ttl);
    if (singleFlight.get(key) === promise) singleFlight.delete(key);
  });
  return promise;
}
