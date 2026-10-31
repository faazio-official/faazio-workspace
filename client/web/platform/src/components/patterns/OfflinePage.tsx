"use client";
import { useCallback, useState } from "react";

import { OfflineState } from "@/components/patterns/OfflineState";
import { useConnectivityStore } from "@/lib/connectivityStore";

/**
 * Branded full-screen "You're offline" page. Shown on a cold start while offline and in place of a
 * navigation attempted while offline. "Try again" re-reads `navigator.onLine`; once online the
 * resume effect in `OfflineGuard` either mounts the portal or replays the pending route.
 */
export function OfflinePage() {
  const recheck = useConnectivityStore((s) => s.recheck);
  const [busy, setBusy] = useState(false);

  const onRetry = useCallback(() => {
    setBusy(true);
    recheck();
    // The store flips synchronously; briefly show the spinner so the tap reads as acknowledged.
    window.setTimeout(() => setBusy(false), 600);
  }, [recheck]);

  return (
    <OfflineState
      title="You're offline"
      message="Looks like you're not connected to the internet. Check your connection and try again."
      onRetry={onRetry}
      busy={busy}
    />
  );
}