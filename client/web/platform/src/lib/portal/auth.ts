"use client";
// Gateway-native SUPER_ADMIN session (no SDK, fetch only). Tokens are held in HttpOnly cookies by
// the /api/auth/portal route handlers; this module only sees the user projection.
import type { AuthUser, Role } from "@/data/types";

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChange: boolean;
  sellerId?: string;
  stateCode?: string;
}

interface PortalResponse {
  user?: PortalUser | null;
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
}

export class PortalError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(message: string, code: string, status: number, requestId = "") {
    super(message);
    this.name = "PortalError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

/** User-facing copy for the three distinct 503 origins (build config / gateway / gateway secret). */
export function portalErrorMessage(err: unknown): string {
  if (!(err instanceof PortalError)) {
    return err instanceof Error ? err.message : "Could not sign in.";
  }
  const ref = err.requestId ? ` (ref: ${err.requestId})` : "";
  switch (err.code) {
    case "not_configured":
      return `This portal build has no gateway URL — rebuild/redeploy with NEXT_PUBLIC_GATEWAY_URL.${ref}`;
    case "gateway_unavailable":
      return `The gateway is unreachable — check the gateway status and retry.${ref}`;
    case "portal_auth_unavailable":
      return `Gateway auth is not configured (PORTAL_JWT_SECRET missing on Render).${ref}`;
    case "portal_unavailable":
      return `The gateway could not read the portal credential tables — apply migrations 0032 + 0033.${ref}`;
    default:
      return `${err.message}${ref}`;
  }
}

export interface PortalStatus {
  portalEnabled: boolean;
  gatewayBaseHost: string;
  gatewayReachable: boolean;
  gatewayAuth: "ok" | "portal_auth_unavailable" | "unreachable";
}

/** Best-effort pre-submit diagnostic (no credentials, no rate-limit consumption). */
export async function fetchPortalStatus(): Promise<PortalStatus | null> {
  try {
    const res = await fetch("/api/auth/portal/status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PortalStatus;
  } catch {
    return null;
  }
}

function toAuthUser(user: PortalUser): AuthUser {
  return {
    accountId: user.id,
    role: user.role,
    name: user.name || user.email,
    email: user.email,
    mustChange: user.mustChange,
    sellerId: user.sellerId,
    stateCode: user.stateCode,
  };
}

async function call(path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<PortalResponse> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data: PortalResponse = {};
  try {
    data = (await res.json()) as PortalResponse;
  } catch {
    // non-JSON edge (gateway down) — fall through to the generic message
  }
  if (!res.ok) {
    throw new PortalError(
      data.error || data.message || `Request failed (${res.status})`,
      data.code || "request_failed",
      res.status,
      data.requestId || res.headers.get("x-request-id") || "",
    );
  }
  return data;
}

/** Signs in against the gateway; throws a user-facing Error on failure. */
export async function loginPortal(email: string, password: string): Promise<AuthUser> {
  const data = await call("/api/auth/portal/login", "POST", { email, password });
  if (!data.user) throw new Error("Sign-in failed.");
  return toAuthUser(data.user);
}

/**
 * One restore verdict. `transient` means the refresh cookie is still valid but the gateway was
 * briefly unreachable (network / 5xx / timeout) — retry, do NOT treat the user as signed out.
 */
export type RestoreOutcome =
  | { status: "ok"; user: AuthUser }
  | { status: "transient" }
  | { status: "signed_out" };

/** Restores a session from the HttpOnly refresh cookie. A gateway blip reports `transient`, never
 *  "signed out" — only the server clearing the cookie (a genuinely dead refresh) yields signed_out. */
export async function restorePortalSession(): Promise<RestoreOutcome> {
  try {
    const data = await call("/api/auth/portal/me", "GET");
    if (data.user) return { status: "ok", user: toAuthUser(data.user) };
    return { status: "signed_out" };
  } catch (err) {
    if (err instanceof PortalError && (err.status === 0 || err.status >= 500)) {
      return { status: "transient" };
    }
    return { status: "signed_out" };
  }
}

export async function logoutPortal(): Promise<void> {
  try {
    await call("/api/auth/portal/logout", "POST", {});
  } catch {
    // best-effort: the local session is cleared regardless
  }
}

export async function changePortalPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await call("/api/auth/portal/password", "PUT", { currentPassword, newPassword });
}
