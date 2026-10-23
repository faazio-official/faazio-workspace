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
  districtCode?: string;
  stateCode?: string;
}

interface PortalResponse {
  user?: PortalUser | null;
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
  expiresIn?: number;
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
    districtCode: user.districtCode,
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

/** Gateway access floor when a route forgets to echo expiresIn (access token is 15 min). */
const ACCESS_FLOOR_SECONDS = 15 * 60;

/** Signed-in verdict + how long the current access token lives (for the keep-alive timer). */
export interface AuthSessionData {
  user: AuthUser;
  expiresIn: number;
}

/**
 * Signs in against the gateway; throws a user-facing Error on failure. `remember` mirrors the
 * GCP-style "Stay signed in" checkbox — unchecked means a browser-session-only refresh cookie.
 */
export async function loginPortal(
  email: string,
  password: string,
  remember = true,
): Promise<AuthSessionData> {
  const data = await call("/api/auth/portal/login", "POST", { email, password, remember });
  if (!data.user) throw new Error("Sign-in failed.");
  return { user: toAuthUser(data.user), expiresIn: data.expiresIn ?? ACCESS_FLOOR_SECONDS };
}

/**
 * One restore verdict. `transient` means the refresh cookie is still valid but the gateway was
 * briefly unreachable (network / 5xx / timeout) — retry, do NOT treat the user as signed out.
 */
export type RestoreOutcome =
  | { status: "ok"; user: AuthUser; expiresIn: number }
  | { status: "transient" }
  | { status: "signed_out" };

/** Restores a session from the HttpOnly refresh cookie. A gateway blip reports `transient`, never
 *  "signed out" — only the server clearing the cookie (a genuinely dead refresh) yields signed_out. */
export async function restorePortalSession(): Promise<RestoreOutcome> {
  try {
    const data = await call("/api/auth/portal/me", "GET");
    if (data.user) {
      return {
        status: "ok",
        user: toAuthUser(data.user),
        expiresIn: data.expiresIn ?? ACCESS_FLOOR_SECONDS,
      };
    }
    return { status: "signed_out" };
  } catch (err) {
    if (err instanceof PortalError && (err.status === 0 || err.status >= 500)) {
      return { status: "transient" };
    }
    return { status: "signed_out" };
  }
}

/* --------------------------- proactive keep-alive (P3.2) --------------------------- */
// GCP never waits for a 401: refresh at ~80% of access life, on tab focus/visibility, and
// single-flight — so a returning operator gets a silent restore instead of a login wall.

const PROACTIVE_REFRESH_RATIO = 0.8;
const TRANSIENT_RETRY_MS = 30_000;
const VISIBILITY_MIN_INTERVAL_MS = 60_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProactive: Promise<ProactiveRefreshResult> | null = null;

export type ProactiveRefreshResult =
  | { status: "ok"; user: AuthUser; expiresIn: number }
  | { status: "transient" }
  | { status: "signed_out" };

/** Single-flight silent rotation through /api/auth/portal/refresh (cookies stay HttpOnly). */
async function proactiveRefresh(): Promise<ProactiveRefreshResult> {
  if (pendingProactive) return pendingProactive;
  pendingProactive = (async () => {
    try {
      const data = await call("/api/auth/portal/refresh", "POST", {});
      if (data.user) {
        const expiresIn = data.expiresIn ?? ACCESS_FLOOR_SECONDS;
        armProactiveRefresh(Math.round(expiresIn * 1000 * PROACTIVE_REFRESH_RATIO));
        return { status: "ok", user: toAuthUser(data.user), expiresIn };
      }
      return { status: "signed_out" };
    } catch (err) {
      if (err instanceof PortalError && (err.status === 0 || err.status >= 500)) {
        // Transient: the refresh cookie is still valid — retry sooner than the 80% mark.
        armProactiveRefresh(TRANSIENT_RETRY_MS);
        return { status: "transient" };
      }
      return { status: "signed_out" };
    } finally {
      pendingProactive = null;
    }
  })();
  return pendingProactive;
}

/** Schedules (or re-schedules) the next silent refresh. In-memory only — never persisted. */
export function armProactiveRefresh(delayMs: number): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void proactiveRefresh();
  }, delayMs);
}

export function cancelProactiveRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  pendingProactive = null;
}

/** Restores a session when the tab regains focus/visibility (throttled to once a minute). Returns
 *  a cleanup function for unmount. Attentive: an active idle >60 s then refocus re-arms refesh. */
export function armVisibilityRefresh(restore: () => void): () => void {
  let lastRestore = 0;
  const onActive = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastRestore < VISIBILITY_MIN_INTERVAL_MS) return;
    lastRestore = now;
    restore();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onActive);
  if (typeof window !== "undefined") window.addEventListener("focus", onActive);
  return () => {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onActive);
    if (typeof window !== "undefined") window.removeEventListener("focus", onActive);
  };
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
