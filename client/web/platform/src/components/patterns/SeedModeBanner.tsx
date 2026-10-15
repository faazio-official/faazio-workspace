"use client";
// A production-only guard: the portal runs on local seeds when NEXT_PUBLIC_GATEWAY_URL is unset.
// That is fine for dev/demo, but in a production build it means the console is NOT reading the
// gateway — surface it so seed data can never masquerade as live data.
import { remoteConfigured } from "@/lib/config";

export function SeedModeBanner() {
  if (remoteConfigured()) return null;
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-3 left-3 z-50 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-[11px] font-semibold text-warning shadow-sm"
    >
      SEED MODE — not connected to gateway
    </div>
  );
}