"use client";

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
}

declare global {
  interface Window {
    /** Injected by the native WebView shell before the portal hydrates. */
    __faazio?: FaazioAppContext;
  }
}

function read(): FaazioAppContext | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__faazio;
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
