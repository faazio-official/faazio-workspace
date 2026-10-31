import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import type { NavigationState } from '@react-navigation/native';
import { GATEWAY_URL } from '@/lib/config';

/**
 * Live device connectivity for the customer app.
 *
 * There is no NetInfo dependency: a lightweight `GET /health` probe (the gateway already exposes
 * it) plus an `AppState` foreground re-check is enough to detect online/offline transitions while
 * staying dependency-free. Any HTTP response — even a 4xx/5xx — proves the network is up; only a
 * thrown fetch/timeout is treated as offline, so a cold backend never reads as "no internet".
 *
 * Shared state lives here (Zustand) per the state rule; components read via selectors and stay
 * presentational. `pendingNavigation` holds the navigation state the user attempted while offline
 * so `offlineNavigationGuard` can replay it once connectivity returns.
 */

const CHECK_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30000;
const HEALTH_URL = GATEWAY_URL ? `${GATEWAY_URL}/health` : '';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let started = false;
let inFlight: Promise<boolean> | null = null;

interface ConnectivityState {
  /** `null` until the first probe completes, so the UI never flashes "offline" on a cold start. */
  isOnline: boolean | null;
  isChecking: boolean;
  lastCheckedAt: number | null;
  /** True once the app has been online at least once this session (distinguishes cold-start offline). */
  hasConnected: boolean;
  pendingNavigation: NavigationState | null;
  navigationBlocked: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  checkConnectivity: () => Promise<boolean>;
  setPendingNavigation: (state: NavigationState) => void;
  clearNavigationBlock: () => void;
}

export const useConnectivityStore = create<ConnectivityState>()((set, get) => ({
  isOnline: null,
  isChecking: false,
  lastCheckedAt: null,
  hasConnected: false,
  pendingNavigation: null,
  navigationBlocked: false,

  checkConnectivity: async () => {
    // Mock/seed mode (no gateway configured): connectivity awareness is meaningless.
    if (!HEALTH_URL) {
      set((state) => ({
        isOnline: true,
        isChecking: false,
        lastCheckedAt: Date.now(),
        hasConnected: true,
      }));
      return true;
    }
    if (inFlight) return inFlight;

    set({ isChecking: true });
    inFlight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
      try {
        await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
        set((state) => ({
          isOnline: true,
          isChecking: false,
          lastCheckedAt: Date.now(),
          hasConnected: true,
        }));
        return true;
      } catch {
        set({ isOnline: false, isChecking: false, lastCheckedAt: Date.now() });
        return false;
      } finally {
        clearTimeout(timeout);
        inFlight = null;
      }
    })();
    return inFlight;
  },

  startMonitoring: () => {
    if (started) return;
    started = true;
    void get().checkConnectivity();
    pollTimer = setInterval(() => {
      void get().checkConnectivity();
    }, POLL_INTERVAL_MS);
    // Returning to the foreground is the most likely moment connectivity changed; re-check then.
    appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void get().checkConnectivity();
    });
  },

  stopMonitoring: () => {
    started = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    appStateSubscription?.remove();
    appStateSubscription = null;
  },

  setPendingNavigation: (state) => set({ pendingNavigation: state, navigationBlocked: true }),
  clearNavigationBlock: () => set({ pendingNavigation: null, navigationBlocked: false }),
}));