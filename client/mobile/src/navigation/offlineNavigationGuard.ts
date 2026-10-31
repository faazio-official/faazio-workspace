import type { NavigationState } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { useConnectivityStore } from '@/state/connectivityStore';

/**
 * Intercepts user navigation while offline. `NavigationContainer.onStateChange` reports the new
 * state; when offline and the focused route actually changed (a forward navigation — going back is
 * allowed so the user is never trapped), the intended state is stored and the navigator is reverted
 * to the previous state, so the destination screen mounts only after reconnect and its HTTP reads
 * fire then. The offline UI page is rendered on top by App.tsx while `navigationBlocked` is true.
 */

// Auth/entry routes are always allowed: an offline session drop must still land on Login, and a
// programmatic reset to the entry screen must not be blocked.
const ALWAYS_ALLOWED = new Set(['Login', 'Onboarding', 'LanguageSelection', 'Location']);

let previousState: NavigationState | undefined;
let reverting = false;

function focusedRoute(state: NavigationState): { key: string; name: string } {
  let route = state.routes[state.index ?? 0];
  let nested = (route as { state?: NavigationState }).state;
  while (nested && nested.routes.length > 0) {
    route = nested.routes[nested.index ?? 0];
    nested = (route as { state?: NavigationState }).state;
  }
  return { key: route.key, name: route.name };
}

export function handleNavigationStateChange(state?: NavigationState): void {
  if (!state) return;
  // A state change we caused by reverting must not itself be intercepted.
  if (reverting) {
    previousState = state;
    return;
  }

  const { isOnline, setPendingNavigation } = useConnectivityStore.getState();
  const next = focusedRoute(state);
  const prev = previousState ? focusedRoute(previousState) : undefined;
  const wentBack = !!previousState && state.routes.length < previousState.routes.length;
  const changedPage = !!prev && prev.key !== next.key;

  if (isOnline === false && changedPage && !wentBack && !ALWAYS_ALLOWED.has(next.name)) {
    setPendingNavigation(state);
    reverting = true;
    if (previousState) navigationRef.reset(previousState);
    // The revert emits its own state change; clear the flag once that tick has been processed.
    setTimeout(() => {
      reverting = false;
    }, 0);
    return;
  }

  previousState = state;
}

/** Replays the navigation the user attempted while offline, once connectivity returns. */
export function replayPendingNavigation(): void {
  const { pendingNavigation, clearNavigationBlock } = useConnectivityStore.getState();
  clearNavigationBlock();
  if (!pendingNavigation || !navigationRef.isReady()) return;
  reverting = true;
  navigationRef.reset(pendingNavigation);
  setTimeout(() => {
    reverting = false;
  }, 0);
}