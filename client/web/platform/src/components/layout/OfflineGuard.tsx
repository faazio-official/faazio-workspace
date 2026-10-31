"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { OfflinePage } from "@/components/patterns/OfflinePage";
import { useConnectivity } from "@/lib/hooks/useConnectivity";

/**
 * Network-awareness layer for the whole portal.
 *
 * - Cold start while offline → the offline page instead of the console (nothing to load).
 * - Connectivity drops mid-session → the current page stays usable; `useConnectivity` raises the
 *   toast. If the user taps an internal link, the click is intercepted (Next App Router has no
 *   `routeChangeStart` event), the destination is stored, and the offline page covers the console.
 * - Connectivity returns → the stored route is pushed, so the page mounts and runs its normal HTTP
 *   reads. Programmatic `router.push` callers use `guardNavigation` from the store.
 *
 * Server-side navigation (full reloads / direct URL entry) is not interceptable and renders normally.
 */
export function OfflineGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isOnline, hasConnected, pendingRoute, navigationBlocked, setPendingRoute, clearPendingRoute } =
    useConnectivity();

  // Intercept internal anchor navigation (next/link) while offline, before React's handlers run.
  useEffect(() => {
    if (isOnline !== false) return;

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || /^(mailto|tel|javascript):/i.test(rawHref)) return;
      if (anchor.hasAttribute("download")) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;

      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const destination = url.pathname + url.search + url.hash;
      if (destination === window.location.pathname + window.location.search + window.location.hash) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingRoute(destination);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isOnline, setPendingRoute]);

  // Resume the intended navigation once connectivity returns. The page mounts fresh and refetches.
  useEffect(() => {
    if (isOnline === true && pendingRoute) {
      const destination = pendingRoute;
      clearPendingRoute();
      router.push(destination);
    }
  }, [isOnline, pendingRoute, clearPendingRoute, router]);

  if (!hasConnected && isOnline === false) {
    return <OfflinePage />;
  }

  return (
    <>
      {children}
      {navigationBlocked && isOnline === false ? (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-background">
          <OfflinePage />
        </div>
      ) : null}
    </>
  );
}