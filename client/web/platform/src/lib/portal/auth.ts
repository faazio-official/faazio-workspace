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
}

interface PortalResponse {
  user?: PortalUser | null;
  error?: string;
  message?: string;
}

function toAuthUser(user: PortalUser): AuthUser {
  return {
    accountId: user.id,
    role: user.role,
    name: user.name || user.email,
    email: user.email,
    password: "",
    mustChange: user.mustChange,
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
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

/** Signs in against the gateway; throws a user-facing Error on failure. */
export async function loginPortal(email: string, password: string): Promise<AuthUser> {
  const data = await call("/api/auth/portal/login", "POST", { email, password });
  if (!data.user) throw new Error("Sign-in failed.");
  return toAuthUser(data.user);
}

/** Restores a session from the HttpOnly refresh cookie (null when signed out). */
export async function restorePortalSession(): Promise<AuthUser | null> {
  try {
    const data = await call("/api/auth/portal/me", "GET");
    return data.user ? toAuthUser(data.user) : null;
  } catch {
    return null;
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
