"use client";
import { RefreshCw, WifiOff } from "lucide-react";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { Button } from "@/components/ui/button";

/**
 * Branded full-screen offline / gateway-unreachable state. Used by the session gate (silent
 * reconnect) and the login diagnostics so a dead gateway never shows a raw 503 or a blank page.
 */
export function OfflineState({
  title = "No internet connection",
  message = "We couldn't reach the Faazio gateway. Check your connection and try again.",
  onRetry,
  busy = false,
}: {
  title?: string;
  message?: string;
  onRetry?: (() => void) | undefined;
  busy?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface max-w-md p-6 text-center">
        <FaazioWordmark className="mx-auto h-5 w-auto text-primary" />
        <div className="mx-auto mb-3 mt-4 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {busy ? <RefreshCw className="size-5 animate-spin" /> : <WifiOff className="size-5" />}
        </div>
        <h1 className="text-[16px] font-semibold">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{message}</p>
        {onRetry ? (
          <Button size="sm" className="mt-4" onClick={onRetry} disabled={busy}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
