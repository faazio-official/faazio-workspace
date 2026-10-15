"use client";
// Minimal Supabase Auth (GoTrue) REST client — no SDK, keeps the bundle lean
// (AGENTS: lightweight). Session (JWT) is persisted locally; the gateway
// validates the same bearer token. Nothing here is a secret: the anon key is
// public by design.
import { authConfigured, config } from "@/lib/config";
import type { AuthUser, Role } from "@/data/types";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  user: AuthUser;
}

interface GoTrueUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: GoTrueUser;
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const ROLES: Role[] = ["SELLER", "STATE_ADMIN", "SUPER_ADMIN"];

function claim(source: Record<string, unknown>, key: string): string {
  const meta = (source["app_metadata"] ?? {}) as Record<string, unknown>;
  const value = source[key] ?? meta[key];
  return typeof value === "string" ? value : "";
}

function toAuthUser(token: string, user: GoTrueUser): AuthUser {
  const claims = decodeJwt(token);
  const roleRaw = (claim(claims, "app_role") || claim({ ...user }, "app_role")).toUpperCase();
  const role = (ROLES.includes(roleRaw as Role) ? roleRaw : "SELLER") as Role;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta["full_name"] === "string" ? meta["full_name"] : (user.email ?? "Partner");
  return {
    accountId: user.id,
    role,
    name,
    email: user.email ?? "",
    password: "",
    stateCode: claim(claims, "state_code") || undefined,
    sellerId: claim(claims, "seller_id") || undefined,
  };
}

/** Restores the persisted session, refreshing when the access token has expired. */
export async function getSession(): Promise<Session | null> {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(config.authStorageKey);
  if (!raw) return null;
  let session: Session;
  try {
    session = JSON.parse(raw) as Session;
  } catch {
    store.removeItem(config.authStorageKey);
    return null;
  }
  if (session.expiresAt * 1000 > Date.now() + 30_000) return session;
  if (!authConfigured()) return session;
  return refresh(session);
}

async function refresh(session: Session): Promise<Session | null> {
  if (!authConfigured()) return session;
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  return persist((await res.json()) as TokenResponse);
}

function persist(token: TokenResponse): Session {
  const session: Session = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + token.expires_in,
    user: toAuthUser(token.access_token, token.user),
  };
  storage()?.setItem(config.authStorageKey, JSON.stringify(session));
  return session;
}

function clearSession(): void {
  storage()?.removeItem(config.authStorageKey);
}

/** Signs in against Supabase Auth. Throws a user-facing Error on failure. */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  if (!authConfigured()) {
    throw new Error("Supabase Auth is not configured (set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  }
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    throw new Error("Invalid email or password.");
  }
  return persist((await res.json()) as TokenResponse);
}

export async function signOutRemote(): Promise<void> {
  const store = storage();
  const raw = store?.getItem(config.authStorageKey);
  if (raw && authConfigured()) {
    try {
      const session = JSON.parse(raw) as Session;
      await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}`, apikey: config.supabaseAnonKey },
      });
    } catch {
      // best-effort; local session is cleared regardless
    }
  }
  clearSession();
}

/** Bearer token for gateway calls, or null when signed out. */
export function accessToken(): string | null {
  const raw = storage()?.getItem(config.authStorageKey);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Session).accessToken;
  } catch {
    return null;
  }
}