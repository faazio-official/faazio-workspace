"use client";
// The single network seam to the Go Chi gateway. Requests go to the same-origin
// /api/gateway proxy, which attaches the HttpOnly portal bearer server-side.
import { remoteConfigured } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Query string params; undefined/empty values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** When true, a 404 resolves to null instead of throwing. */
  allow404?: boolean;
}

function url(path: string, query?: RequestOptions["query"]): string {
  // The browser talks to the same-origin proxy, which injects the HttpOnly bearer token
  // server-side so the token is never readable by JavaScript.
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const u = new URL(`/api/gateway${path}`, origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  }
  return u.pathname + u.search;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!remoteConfigured()) {
    throw new ApiError(0, "offline", "Gateway is not configured");
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  const res = await fetch(url(path, options.query), init);

  if (options.allow404 && res.status === 404) return null as T;
  if (!res.ok) {
    let code = "request_failed";
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; code?: string; message?: string };
      if (body.code) code = body.code;
      if (body.error) message = body.error;
      else if (body.message) message = body.message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const remote = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};

/**
 * Fire-and-forget write-behind. The portal writes optimistically to the local store first; this
 * pushes the same change to the gateway when configured, and silently keeps the optimistic state
 * (seed fallback) if the call fails. Callers never await, so pages stay synchronous.
 */
export function writeBehind(
  method: "post" | "put" | "patch" | "delete",
  path: string,
  body?: unknown,
): void {
  if (!remoteConfigured()) return;
  const pending = method === "delete" ? remote.delete(path) : remote[method](path, body);
  Promise.resolve(pending).catch(() => {
    /* keep the optimistic local state; the next hydrate reconciles */
  });
}

/**
 * Awaited write to the gateway. Unlike `writeBehind`, the returned promise rejects on failure, so a
 * caller can roll back its optimistic state and surface the error. No-op (resolved) in seed mode.
 */
export function writeAwaited(
  method: "post" | "put" | "patch" | "delete",
  path: string,
  body?: unknown,
): Promise<void> {
  if (!remoteConfigured()) return Promise.resolve();
  const pending = method === "delete" ? remote.delete(path) : remote[method](path, body);
  return Promise.resolve(pending).then(() => undefined);
}

/**
 * Defensive snack_case -> camelCase normalizer. The gateway already emits
 * camelCase JSON, but handlers that pass DB rows through keep the web honest.
 */
export function toCamel<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => toCamel(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      out[key] = toCamel(v);
    }
    return out as unknown as T;
  }
  return value;
}