"use client";
import { usePortalStore } from "@/lib/api/store";
import type { AuthUser } from "@/data/types";

export function useSession(): AuthUser | null {
  return usePortalStore((s) => s.session);
}
