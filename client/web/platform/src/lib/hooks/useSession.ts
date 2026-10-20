"use client";
import { usePortalStore, type SessionStatus } from "@/lib/api/store";
import type { AuthUser } from "@/data/types";

export function useSession(): AuthUser | null {
  return usePortalStore((s) => s.session);
}

export function useSessionStatus(): SessionStatus {
  return usePortalStore((s) => s.sessionStatus);
}
