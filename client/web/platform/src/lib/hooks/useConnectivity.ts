"use client";
import { useEffect } from "react";
import { toast } from "sonner";

import { useConnectivityStore } from "@/lib/connectivityStore";

/** Sonner toast id shared across transitions so the offline toast can be dismissed on reconnect. */
const OFFLINE_TOAST_ID = "faazio-offline";

/**
 * Subscribes the window to connectivity transitions: syncs `navigator.onLine` into the store,
 * raises the transient "You're offline" toast when connectivity drops mid-session, and dismisses it
 * on reconnect. The full-screen cold-start / navigation-block UI lives in `OfflineGuard`.
 */
export function useConnectivity() {
  const setOnline = useConnectivityStore((s) => s.setOnline);

  useEffect(() => {
    const sync = () => {
      const previous = useConnectivityStore.getState().isOnline;
      const next = typeof navigator === "undefined" ? true : navigator.onLine;
      if (next === false && previous === true) {
        toast.error("You're offline", {
          id: OFFLINE_TOAST_ID,
          description: "Check your connection — we'll retry when you're back.",
        });
      } else if (next === true && previous === false) {
        toast.dismiss(OFFLINE_TOAST_ID);
      }
      setOnline(next);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [setOnline]);

  return useConnectivityStore();
}