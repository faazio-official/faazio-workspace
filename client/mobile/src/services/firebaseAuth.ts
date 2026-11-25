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
import { Platform } from 'react-native';
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
import { isOtpSessionExpired, otpErrorCode } from '@/lib/otpError';

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

interface OtpAuthTarget {
  auth: Auth;
  /** True only when the disposable secondary app was created and must be torn down afterwards. */
  disposable: boolean;
}

/**
 * Resolve the Firebase app that should carry this OTP round-trip.
 *
 * A phone-auth UID is derived from the phone number, so when the seller signature targets the SAME
 * number that already owns the primary session, sending/verifying it on the primary app cannot
 * change identity — it only re-authenticates the same user. Doing so avoids the secondary app's
 * app-verification path (Play Integrity / reCAPTCHA), which is unreliable on sideloaded Android
 * builds and was surfacing as a red "Could not send the OTP" on the signature step.
 *
 * Every other target (a contact number the shopper did not sign in with) still uses the disposable
 * secondary app so the shopper's session is never swapped.
 */
async function otpAuth(scope: OtpScope, phone?: string): Promise<OtpAuthTarget> {
  const primary = getAuth();
  if (scope === 'primary') return { auth: primary, disposable: false };
  if (phone && primary.currentUser?.phoneNumber === phone) {
    return { auth: primary, disposable: false };
  }
  const existing = getApps().find((app) => app.name === OTP_APP_NAME);
  const app = existing ?? (await initializeApp(getApp().options, OTP_APP_NAME));
  return { auth: getAuth(app), disposable: true };
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

/**
 * Firebase codes that mean "this install could not prove it is the registered app" — a Play Integrity
 * rejection on a sideloaded build that the SDK then cannot retry on its own.
 */
const APP_VERIFICATION_FAILURE_CODES = new Set([
  'auth/invalid-app-credential',
  'auth/missing-client-identifier',
  'auth/app-not-authorized',
  // Some firebase-auth versions surface a rejected Play Integrity token as a generic internal error.
  'auth/internal-error',
]);

/**
 * Sideloaded Android builds (CI debug APK, non-Play release APK) cannot pass Play Integrity, so the
 * SDK falls back to reCAPTCHA. Firebase's current Android SDK defaults that fallback to **reCAPTCHA
 * Enterprise**, which needs a site key linked from Google Cloud (`FIREBASE_AUTH.md` Part 6, not done
 * yet) — without it the send dies with `Failed to initialize reCAPTCHA config: No Recaptcha
 * Enterprise siteKey configured` and **no SMS is dispatched**. Forcing the legacy reCAPTCHA v2 web
 * flow for the retry restores the documented fallback using only the signing fingerprints already
 * registered in Firebase. Play-installed builds never hit this path (Play Integrity succeeds).
 */
function isAppVerificationFailure(err: unknown): boolean {
  const code = otpErrorCode(err);
  return code !== null && APP_VERIFICATION_FAILURE_CODES.has(code);
}

/** Legacy reCAPTCHA v2 is the only fallback that works before Part 6 is configured. */
function forceLegacyRecaptchaFlow(auth: Auth): boolean {
  const settings = auth.settings as Auth['settings'] & {
    /** Present in RNFB Auth (Android), missing from its published `AuthSettings` type. */
    forceRecaptchaFlowForTesting?: boolean;
  };
  if (settings.forceRecaptchaFlowForTesting) return false;
  if (Platform.OS !== 'android') return false;
  settings.forceRecaptchaFlowForTesting = true;
  return true;
}

async function requestSmsCode(auth: Auth, phone: string): Promise<ConfirmationResult> {
  try {
    return await signInWithPhoneNumber(auth, phone);
  } catch (err) {
    if (!isAppVerificationFailure(err) || !forceLegacyRecaptchaFlow(auth)) throw err;
    if (__DEV__) {
      console.warn('[phone-auth] Play Integrity unavailable — retrying with reCAPTCHA v2');
    }
    return signInWithPhoneNumber(auth, phone);
  }
}

async function sendOtpForScope(phoneDigits: string, scope: OtpScope): Promise<void> {
  if (!firebaseAuthConfigured()) {
    throw new Error('Firebase Auth is not configured.');
  }
  const phone = toE164(phoneDigits);
  const { auth, disposable } = await otpAuth(scope, phone);
  // Dev/simulator only: the iOS simulator always uses Firebase's reCAPTCHA web sheet. With app
  // verification disabled, a console registered test number signs in without leaving the app.
  // iOS-only on purpose: Android debug must behave like production, so verification is never
  // skipped there — a sideloaded debug APK falls back to reCAPTCHA (Play Integrity needs Play).
  if (FIREBASE_APP_VERIFICATION_DISABLED && Platform.OS === 'ios') {
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
    current.confirmation = await requestSmsCode(auth, phone);
  } catch (err) {
    if (pending === current) {
      pending = null;
      clearAutoWatch();
    }
    if (disposable && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
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
  const { auth, disposable } = await otpAuth(scope, phone);
  // Auto-retrieval already produced the session; any code entry can resolve it.
  if (current.autoSession) {
    const session = current.autoSession;
    if (pending === current) {
      pending = null;
      clearAutoWatch();
    }
    if (disposable && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
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
    if (disposable && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
    return session;
  } catch (err) {
    current.manualVerifyStarted = false;
    // The watcher yields to a manual confirm, so it may have skipped an auto session that landed
    // concurrently. Recover it before surfacing an invalid-code error.
    const recovered = current.autoSession ?? (await recoverSessionFromCurrentUser(auth, current));
    if (recovered) {
      if (pending === current) {
        pending = null;
        clearAutoWatch();
      }
      if (disposable && (!pending || pending.scope !== 'seller')) await disposeOtpApp();
      return recovered;
    }
    // The verification session is dead (expired code / superseded verification id). Drop it so a
    // stale confirmation can never be reused; only a fresh send (resend) can now succeed.
    if (isOtpSessionExpired(err) && pending === current) {
      pending = null;
      clearAutoWatch();
    }
    throw err;
  }
}

/**
 * Abandon the pending primary OTP round-trip (the user backed out of the code screen). Drops the
 * confirmation and the auto-verification watch so a late auto-retrieval for the abandoned number
 * can never leak into the next send, and signs out a session that native auto-retrieval created
 * but the UI never consumed. The next number then starts from a clean Firebase session.
 */
export function cancelPrimaryOtp(): void {
  const current = pending;
  if (!current || current.scope !== 'primary') return;
  pending = null;
  clearAutoWatch();
  if (current.autoSession) void signOutRemote();
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
