"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { restoreSession } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Restore a persisted Supabase session, then hydrate the store from the
  // gateway. Both are no-ops in local seed mode (env unset).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await restoreSession();
      if (!cancelled && user) await hydrateFromGateway();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={120}>{children}</TooltipProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}