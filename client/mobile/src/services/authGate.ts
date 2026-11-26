import { navigationRef } from '@/navigation/navigationRef';
import { useAuthStore } from '@/state/authStore';

/**
 * Shared guest gate for the customer app.
 *
 * Swiggy-style guest browsing: signed-out users reach `MainTabs` and can browse the
 * catalogue, but account-bound actions (checkout, favourites, orders, rewards,
 * prescription upload) open `Login` instead of calling an auth-scoped gateway
 * endpoint. The action that triggered the gate is kept here so a successful
 * sign-in can resume it after the login screen closes.
 *
 * No React state: callers use this from callbacks (`onPress`), and the root
 * navigator owns the actual screen.
 */

let pendingAction: (() => void) | null = null;

export function isGuest(): boolean {
  return !useAuthStore.getState().isAuthenticated;
}

/** Open the root `Login` screen over the current browsing surface. */
export function openSignIn(): void {
  if (!navigationRef.isReady()) return;
  if (navigationRef.getCurrentRoute()?.name === 'Login') return;
  navigationRef.navigate('Login', { resume: true });
}

/**
 * Run `action` when signed in; otherwise remember it and open `Login`.
 * Returns true when the caller may proceed immediately.
 */
export function runAuthGate(action?: () => void): boolean {
  if (!isGuest()) return true;
  pendingAction = action ?? null;
  openSignIn();
  return false;
}

/**
 * Called by `LoginScreen` after a resume sign-in closes. The origin screen stays
 * mounted under the pushed login screen, so the closure is still valid.
 */
export function consumePendingAuthAction(): void {
  const action = pendingAction;
  pendingAction = null;
  if (action) action();
}

export function clearPendingAuthAction(): void {
  pendingAction = null;
}
