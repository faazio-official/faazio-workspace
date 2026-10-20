"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SeedModeBanner } from "@/components/patterns/SeedModeBanner";
import { restoreSession } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";
import { usePortalStore } from "@/lib/api/store";

// Transient gateway failures (cold start / Cloudflare blip) never log the user out: the refresh
// cookie is still valid, so keep retrying with backoff before ever showing the login gate.
const TRANSIENT_BACKOFF_MS = [1000, 3000, 8000];

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Restore a persisted Supabase session, then hydrate the store from the
  // gateway. Both are no-ops in local seed mode (env unset).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; ; attempt += 1) {
        const result = await restoreSession();
        if (cancelled) return;
        if (result.status === "signed-in") {
          await hydrateFromGateway();
          return;
        }
        if (result.status === "signed-out") return;
        if (attempt >= TRANSIENT_BACKOFF_MS.length) {
          // The gateway is still unreachable — surface the sign-in gate rather than retry forever.
          usePortalStore.getState().set(() => ({
            session: null,
            sessionStatus: "signed-out",
          }));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, TRANSIENT_BACKOFF_MS[attempt]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
      <SeedModeBanner />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}