"use client";
import { useEffect } from "react";
import { isNativeApp, isNativeSellerApp } from "@/lib/appContext";

/**
 * Exposes the native app context on <html> (`data-faazio-app`, `data-faazio-webview`, and a
 * `faazio-app-seller` class) so layouts and CSS can adapt after hydration. Renders nothing.
 */
export function AppContextDetector() {
  useEffect(() => {
    const root = document.documentElement;
    const ctx = window.__faazio;
    if (ctx?.app) root.dataset["faazioApp"] = ctx.app;
    if (isNativeApp()) root.dataset["faazioWebview"] = "true";
    if (isNativeSellerApp()) root.classList.add("faazio-app-seller");
    return () => {
      delete root.dataset["faazioApp"];
      delete root.dataset["faazioWebview"];
      root.classList.remove("faazio-app-seller");
    };
  }, []);

  return null;
}
