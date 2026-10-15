"use client";

import { useEffect, useState } from "react";

/**
 * True only after the client has mounted. Shells and gates render their
 * skeleton until then so the persisted Zustand store never hydrates a
 * different tree on the server pass.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}