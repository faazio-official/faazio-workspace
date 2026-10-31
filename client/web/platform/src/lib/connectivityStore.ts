"use client";
// Live browser connectivity for the portal (seller + admin consoles). Uses the native
// `navigator.onLine` flag plus `online`/`offline` window events — no dependency. Shared state lives
// in this Zustand store; components read via selectors and stay presentational.
import { create } from "zustand";

interface ConnectivityState {
  /** `null` until the client syncs from `navigator.onLine`, so SSR and hydration never disagree. */
  isOnline: boolean | null;
  /** True once the app has been online at least once this session (distinguishes cold-start offline). */
  hasConnected: boolean;
  /** Internal route the user tried to open while offline; replayed on reconnect. */
  pendingRoute: string | null;
  navigationBlocked: boolean;
  setOnline: (online: boolean) => void;
  /** Re-read `navigator.onLine` (the "Try again" path). */
  recheck: () => void;
  setPendingRoute: (route: string) => void;
  clearPendingRoute: () => void;
  /** Returns true when navigation may proceed; otherwise stores the route and blocks. */
  guardNavigation: (href: string) => boolean;
}

function readOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export const useConnectivityStore = create<ConnectivityState>()((set, get) => ({
  isOnline: null,
  hasConnected: false,
  pendingRoute: null,
  navigationBlocked: false,

  setOnline: (online) =>
    set((state) => ({ isOnline: online, hasConnected: state.hasConnected || online })),

  recheck: () =>
    set((state) => {
      const online = readOnline();
      return { isOnline: online, hasConnected: state.hasConnected || online };
    }),

  setPendingRoute: (route) => set({ pendingRoute: route, navigationBlocked: true }),
  clearPendingRoute: () => set({ pendingRoute: null, navigationBlocked: false }),

  guardNavigation: (href) => {
    if (get().isOnline === false) {
      set({ pendingRoute: href, navigationBlocked: true });
      return false;
    }
    return true;
  },
}));