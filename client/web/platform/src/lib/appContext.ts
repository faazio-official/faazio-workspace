"use client";

import type { Role } from "@/data/types";

/**
 * Native WebView app detection.
 *
 * The seller app injects `window.__faazio` via `injectedJavaScriptBeforeContentLoaded` (see
 * `client/mobile/src/features/seller-partner/screens/SellerWebViewScreen.tsx`) before the portal
 * hydrates. We never parse the user-agent (unreliable); the flag is the single source of truth.
 *
 * This only adapts UX/routes client-side after hydration — the real security boundary stays the
 * gateway JWT (`app_role` / `iss=faazio-portal`).
 */
export type FaazioAppVariant = "seller" | "customer" | "delivery";
export type FaazioPlatform = "android" | "ios" | "web";

export interface FaazioAppContext {
  app?: FaazioAppVariant;
  platform?: FaazioPlatform;
  webview?: boolean;
  /** The vendor (directory.stores id) the native seller shell last had active, so the console can
   *  restore the same shop context across WebView reloads. Undefined for browser sessions. */
  vendorId?: string;
}

export type FaazioPermissionKind = "camera" | "location" | "notifications" | "storage";

export interface FaazioPermissionResult {
  requestId: string;
  kind: FaazioPermissionKind;
  granted: boolean;
  status: "granted" | "denied" | "blocked" | "handled-by-webview";
}

const PERMISSION_EVENT = "faazio-permission-result";

declare global {
  interface Window {
    /** Injected by the native WebView shell before the portal hydrates. */
    __faazio?: FaazioAppContext;
    /** Present only inside a React Native WebView. */
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

function read(): FaazioAppContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__faazio;
}

/**
 * Ask the native seller shell for an OS permission (camera/location/notifications/storage).
 *
 * The native side answers with a `faazio-permission-result` CustomEvent; the browser (and any
 * non-native session) resolves as "handled-by-webview" so callers keep their normal behaviour.
 * Never assume a grant: check `result.granted`.
 */
export function requestNativePermission(
  kind: FaazioPermissionKind,
  timeoutMs = 20000,
): Promise<FaazioPermissionResult> {
  if (typeof window === "undefined" || !isNativeApp() || !window.ReactNativeWebView) {
    return Promise.resolve({
      requestId: "",
      kind,
      granted: true,
      status: "handled-by-webview",
    });
  }
  const bridge = window.ReactNativeWebView;
  const requestId = `perm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    const finish = (result: FaazioPermissionResult) => {
      window.removeEventListener(PERMISSION_EVENT, listener as EventListener);
      clearTimeout(timer);
      resolve(result);
    };
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<FaazioPermissionResult>).detail;
      if (!detail || detail.requestId !== requestId) return;
      finish(detail);
    };
    const timer = setTimeout(
      () => finish({ requestId, kind, granted: false, status: "blocked" }),
      timeoutMs,
    );
    window.addEventListener(PERMISSION_EVENT, listener as EventListener);
    bridge.postMessage(JSON.stringify({ type: "faazio:permission", requestId, kind }));
  });
}

/** True inside any native WebView shell (seller/delivery). */
export function isNativeApp(): boolean {
  return read()?.webview === true;
}

/** True only inside the native Seller app WebView. */
export function isNativeSellerApp(): boolean {
  const ctx = read();
  return ctx?.webview === true && ctx.app === "seller";
}

/** Seller-scoped paths the native seller app is allowed to reach. */
export function isSellerScopedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/seller") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/security")
  );
}

/**
 * The single definition of "this role may not sign in / stay signed in inside the native seller
 * app". Used by the login page (rejects at sign-in) and the shells/gates (clear a stale session).
 * A plain browser returns `false`, so the full portal keeps working unchanged.
 */
export function isBlockedInNativeSellerApp(role: Role | string | null | undefined): boolean {
  return isNativeSellerApp() && !!role && role !== "SELLER";
}
