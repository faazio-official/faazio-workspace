/**
 * Firebase Phone Auth via the native SDK (`@react-native-firebase/auth`). This is the single
 * OTP surface for the app: `sendOtp` triggers the native verification flow (auto-retrieval via
 * Play Integrity / APNs when available, reCAPTCHA otherwise) and `verifyOtp` exchanges the
 * 6-digit code for a Firebase ID token (JWT).
 *
 * The ID token is the bearer the Go gateway verifies (`internal/platform/auth`). Firebase ID
 * tokens live ~1 h and are refreshed natively; `refreshIdToken` forces a rotation on a 401.
 * The Firebase refresh token never leaves the native SDK, and nothing here logs tokens,
 * phone numbers or OTP codes.
 */
import { deleteApp, getApp, getApps, initializeApp } from '@react-native-firebase/app';
import {
  getAuth,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import {
  FIREBASE_APP_VERIFICATION_DISABLED,
  FIREBASE_AUTH_ENABLED,
} from '../lib/config';
import { DEFAULT_COUNTRY, toE164 as normalizePhone } from '@/lib/phone';

export interface FirebaseUser {
  uid: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  email?: string | null;
}

export interface FirebaseSession {
  accessToken: string;
  /** Unix seconds. */
  expiresAt: number;
  user: FirebaseUser;
}

type OtpScope = 'primary' | 'seller';

type PendingOtp = {
  phone: string;
  scope: OtpScope;
  confirmation: ConfirmationResult | null;
  /**
   * Set while a manual `confirm(code)` is in flight so the auth-state watcher cannot complete the
   * same verification twice (native sign-in also fires `onAuthStateChanged`).
   */
  manualVerifyStarted: boolean;
  /** Native auto-retrieval already signed the user in; no code entry is needed. */
  autoSession: FirebaseSession | null;
  /** Identity on the auth instance before this send, so a pre-existing session is never mistaken. */
  initialUid: string | null;
  initialSignIn: string | null;
};

/** Pending native phone verification for the current send→verify round-trip. */
let pending: PendingOtp | null = null;
let autoWatchUnsubscribe: (() => void) | null = null;
const autoVerifiedListeners = new Set<() => void>();

function clearAutoWatch(): void {
  autoWatchUnsubscribe?.();
  autoWatchUnsubscribe = null;
}

/**
 * Native Firebase can complete phone verification without user input (Android auto-retrieval or
 * iOS instant verification). The modular `signInWithPhoneNumber` API has no
 * `onVerificationCompleted` callback, but the native SDK signs the user in, so
 * `onAuthStateChanged` is the only reliable JS signal.
 *
 * This watcher never treats a pre-existing session as a successful OTP (delete-account re-auth)
 * and yields to a manual `confirm()` that is already in flight.
 */
function armAutoVerificationWatch(auth: Auth, current: PendingOtp): void {
  clearAutoWatch();
  autoWatchUnsubscribe = auth.onAuthStateChanged(async (user) => {
    if (pending !== current || current.manualVerifyStarted) return;
    if (!user || user.phoneNumber !== current.phone) return;
    if (
      current.initialUid &&
      user.uid === current.initialUid &&
      user.metadata.lastSignInTime === current.initialSignIn
    ) {
      return;
    }
    try {
      const token = await user.getIdTokenResult();
      if (pending !== current || current.manualVerifyStarted) return;
      current.autoSession = toSession(
        user,
        token.token,
        Math.floor(new Date(token.expirationTime).getTime() / 1000),
      );
      clearAutoWatch();
      autoVerifiedListeners.forEach((listener) => {
        try {
          listener();
        } catch {
          // A screen listener must never break the auth state machine.
        }
      });
    } catch {
      // Auto-verification is best-effort; manual code entry remains available.
    }
  });
}

/** Notified when native Firebase auto-verifies the pending primary OTP. */
export function subscribeOtpAutoVerified(listener: () => void): () => void {
  autoVerifiedListeners.add(listener);
  return () => {
    autoVerifiedListeners.delete(listener);
  };
}

/**
 * Take the auto-verified session for a primary OTP and clear the pending request. Returns null
 * when auto-verification has not completed (or another screen already consumed it).
 */
export function consumeAutoVerifiedOtp(phoneDigits: string): FirebaseSession | null {
  const phone = toE164(phoneDigits);
  if (!pending || pending.phone !== phone || pending.scope !== 'primary' || !pending.autoSession) {
    return null;
  }
  const session = pending.autoSession;
  pending = null;
  clearAutoWatch();
  return session;
}

/** Non-consuming probe used by screens that complete re-auth through `verifyReauthOtp`. */
export function hasAutoVerifiedOtp(phoneDigits: string): boolean {
  const phone = toE164(phoneDigits);
  return Boolean(
    pending && pending.phone === phone && pending.scope === 'primary' && pending.autoSession,
  );
}

/**
 * Native auto-retrieval can sign in while a manual `confirm()` is in flight; Firebase then
 * invalidates the code, so recover the already-signed-in user instead of reporting a false
 * "invalid code". A pre-existing session (same uid + sign-in time) is never accepted.
 */
async function recoverSessionFromCurrentUser(
  auth: Auth,
  current: PendingOtp,
): Promise<FirebaseSession | null> {
  const user = auth.currentUser;
  if (!user || user.phoneNumber !== current.phone) return null;
  if (
    current.initialUid &&
    user.uid === current.initialUid &&
    user.metadata.lastSignInTime === current.initialSignIn
  ) {
    return null;
  }
  try {
    const token = await user.getIdTokenResult();
    return toSession(
      user,
      token.token,
      Math.floor(new Date(token.expirationTime).getTime() / 1000),
    );
  } catch {
    return null;
  }
}

/**
 * Seller onboarding treats the OTP as a digital signature while the shopper is already signed in.
 * Verifying on the primary Firebase app would swap the session to the phone-auth UID, so the
 * signature uses a disposable secondary app instead and leaves the shopper session untouched.
 */
const OTP_APP_NAME = 'faazio-seller-otp';

async function otpAuth(scope: OtpScope) {
  if (scope === 'primary') return getAuth();
  const existing = getApps().find((app) => app.name === OTP_APP_NAME);
  const app = existing ?? (await initializeApp(getApp().options, OTP_APP_NAME));
  return getAuth(app);
}

async function disposeOtpApp(): Promise<void> {
  const app = getApps().find((candidate) => candidate.name === OTP_APP_NAME);
  if (!app) return;
  try {
    await deleteApp(app);
  } catch {
    // best-effort: a leftover secondary app is harmless and reused on the next attempt
  }
}

/** Native Firebase is configured when the app instance exists (google-services.json / plist). */
export function firebaseAuthConfigured(): boolean {
  if (!FIREBASE_AUTH_ENABLED) return false;
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

/**
 * Normalize a phone number into E.164 (`+CC…`) — Firebase requires a country code. Callers that
 * predate the country picker omit `country` and keep the historical `+91` assumption; a number
 * that already starts with `+` is always treated as international.
 */
export function toE164(digits: string, country: string = DEFAULT_COUNTRY): string {
  return normalizePhone(digits, country);
}

function toSession(user: User, accessToken: string, expiresAt: number): FirebaseSession {
  return {
    accessToken,
    expiresAt,
    user: {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName,
      email: user.email,
    },
  };
}

async function sendOtpForScope(phoneDigits: string, scope: OtpScope): Promise<void> {
  if (!firebaseAuthConfigured()) {
    throw new Error('Firebase Auth is not configured.');
  }
  const phone = toE164(phoneDigits);
  const auth = await otpAuth(scope);
  // Dev/simulator only: the iOS simulator always uses Firebase's reCAPTCHA web sheet. With app
  // verification disabled, a console registered test number signs in without leaving the app.
  if (FIREBASE_APP_VERIFICATION_DISABLED) {
    auth.settings.appVerificationDisabledForTesting = true;
  }
  const current: PendingOtp = {
    phone,
    scope,
    confirmation: null,
    manualVerifyStarted: false,
    autoSession: null,
    initialUid: auth.currentUser?.uid ?? null,
    initialSignIn: auth.currentUser?.metadata.lastSignInTime ?? null,
  };
  // Replace any earlier request; an old confirmation must never verify a newer send.
  pending = current;
  // Arm before the request: native auto-retrieval can sign in as soon as the SMS lands.
  if (scope === 'primary') armAutoVerificationWatch(auth, current);
  try {
    current.confirmation = await signInWithPhoneNumber(auth, phone);
  } catch (err) {
    if (pending === current) {
      pending = null;
      clearAutoWatch();
    }
    if (scope === 'seller' && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
    throw err;
  }
}

async function verifyOtpForScope(
  phoneDigits: string,
  code: string,
  scope: OtpScope,
): Promise<FirebaseSession> {
  if (!firebaseAuthConfigured()) {
    throw new Error('Firebase Auth is not configured.');
  }
  const phone = toE164(phoneDigits);
  const current = pending;
  if (!current || current.phone !== phone || current.scope !== scope) {
    throw new Error('No OTP request is pending.');
  }
  // Auto-retrieval already produced the session; any code entry can resolve it.
  if (current.autoSession) {
    const session = current.autoSession;
    if (pending === current) {
      pending = null;
      clearAutoWatch();
    }
    if (scope === 'seller' && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
    return session;
  }
  if (!current.confirmation) {
    throw new Error('No OTP request is pending.');
  }
  current.manualVerifyStarted = true;
  try {
    const credential = await current.confirmation.confirm(code);
    // Only clear this request; a resend that landed meanwhile owns the new pending state.
    if (pending === current) {
      pending = null;
      clearAutoWatch();
    }
    const token = await credential.user.getIdTokenResult();
    const session = toSession(
      credential.user,
      token.token,
      Math.floor(new Date(token.expirationTime).getTime() / 1000),
    );
    if (scope === 'seller' && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
    return session;
  } catch (err) {
    current.manualVerifyStarted = false;
    // The watcher yields to a manual confirm, so it may have skipped an auto session that landed
    // concurrently. Recover it before surfacing an invalid-code error.
    const auth = await otpAuth(scope);
    const recovered = current.autoSession ?? (await recoverSessionFromCurrentUser(auth, current));
    if (recovered) {
      if (pending === current) {
        pending = null;
        clearAutoWatch();
      }
      if (scope === 'seller' && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
      return recovered;
    }
    throw err;
  }
}

/**
 * Send (or resend) a 6-digit SMS OTP through the native Firebase SDK. Android may verify
 * automatically without the user typing; iOS falls back to reCAPTCHA without APNs.
 *
 * This signs in the primary app so `refreshIdToken()` can keep the session alive; use the
 * seller variants when the OTP is only a signature on an existing shopper session.
 */
export async function sendOtp(phoneDigits: string): Promise<void> {
  await sendOtpForScope(phoneDigits, 'primary');
}

/** Verify the SMS code and return the Firebase ID token session. */
export async function verifyOtp(phoneDigits: string, code: string): Promise<FirebaseSession> {
  return verifyOtpForScope(phoneDigits, code, 'primary');
}

/** Send an OTP used as a seller-onboarding signature without touching the shopper session. */
export async function sendSellerOtp(phoneDigits: string): Promise<void> {
  await sendOtpForScope(phoneDigits, 'seller');
}

/** Verify a seller-signature OTP; the shopper's primary Firebase session is unchanged. */
export async function verifySellerOtp(
  phoneDigits: string,
  code: string,
): Promise<FirebaseSession> {
  return verifyOtpForScope(phoneDigits, code, 'seller');
}

/**
 * Rotate the current Firebase ID token (forced refresh). Returns null when there is no
 * persisted native user, so the caller clears the Keychain session and returns to Login.
 */
export async function refreshIdToken(): Promise<FirebaseSession | null> {
  if (!firebaseAuthConfigured()) return null;
  const user = getAuth().currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdTokenResult(true);
    return toSession(user, token.token, Math.floor(new Date(token.expirationTime).getTime() / 1000));
  } catch {
    return null;
  }
}

/** Best-effort native sign-out; the caller clears the Keychain session regardless. */
export async function signOutRemote(): Promise<void> {
  if (!firebaseAuthConfigured()) return;
  try {
    await signOut(getAuth());
  } catch {
    // best-effort
  }
}

/**
 * Permanently delete the Firebase Auth identity (the phone account in Firebase) — distinct from
 * signOut(), which only clears the device session. Firebase requires recent authentication for
 * user.delete(), so account deletion runs an OTP re-auth first. No-op when Firebase is
 * unconfigured or no user is signed in.
 */
export async function deleteFirebaseUser(): Promise<void> {
  if (!firebaseAuthConfigured()) return;
  const user = getAuth().currentUser;
  if (!user) return;
  await user.delete();
}

/** Display name from the Firebase profile, falling back to the phone (never blank). */
export function displayName(user: FirebaseUser): string {
  return user.displayName || user.phoneNumber || 'Faazio User';
}
