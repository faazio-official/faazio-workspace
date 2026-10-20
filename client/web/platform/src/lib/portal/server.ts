// Server-only helpers for the gateway-native portal session. Tokens live in HttpOnly cookies set
// by these route handlers — never in localStorage — and every gateway call is proxied same-origin so
// the browser never holds a bearer token that XSS could read.
import type { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "faazio_pat";
export const REFRESH_COOKIE = "faazio_prt";
export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

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

/** True when this deployment is configured for the gateway-native portal session. */
export function portalEnabled(): boolean {
  return process.env["NEXT_PUBLIC_AUTH_MODE"] === "portal";
}

/** Gateway origin without a trailing slash. */
export function gatewayBase(): string {
  return process.env["NEXT_PUBLIC_GATEWAY_URL"]?.replace(/\/+$/, "") ?? "";
}

function cookieOptions(maxAge: number): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(
  res: NextResponse,
  accessToken?: string | undefined,
  refreshToken?: string | undefined,
): void {
  if (accessToken) res.cookies.set(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  if (refreshToken) res.cookies.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  res.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

export function accessCookie(req: NextRequest): string {
  return req.cookies.get(ACCESS_COOKIE)?.value ?? "";
}

export function refreshCookie(req: NextRequest): string {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? "";
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

export interface RefreshResult {
  ok: boolean;
  data: PortalTokenPayload | null;
}

/** Rotates the opaque refresh token through the gateway. */
export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  if (!refreshToken) return { ok: false, data: null };
  try {
    const res = await callGateway("/auth/portal/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return { ok: false, data: null };
    const data = (await res.json()) as PortalTokenPayload;
    if (!data.accessToken || !data.refreshToken) return { ok: false, data: null };
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}
