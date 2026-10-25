"use client";
import { useEffect, useState } from "react";
import { remote } from "@/lib/api/http";
import { remoteConfigured } from "@/lib/config";
import { useSession } from "@/lib/hooks/useSession";

declare global {
  interface Window {
    /** Injected by the native seller WebView shell after FCM registration. */
    __faazioPushToken?: string;
    __faazioPushPlatform?: "android" | "ios" | "web";
  }
}

/**
 * Bridges the native seller app's FCM token into the portal session. The native shell owns
 * Firebase (the WebView cannot receive FCM); the portal registers the token through the
 * authenticated same-origin gateway proxy, so no native portal token is ever needed.
 */
export function SellerPushBridge() {
  const session = useSession();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setToken(window.__faazioPushToken ?? null);
    read();
    window.addEventListener("faazio-push-token", read);
    return () => window.removeEventListener("faazio-push-token", read);
  }, []);

  useEffect(() => {
    if (!session || !token || !remoteConfigured()) return;
    const platform = window.__faazioPushPlatform ?? "android";
    void remote
      .post("/notifications/register", { token, platform })
      .catch(() => undefined);
  }, [session, token]);

  return null;
}
