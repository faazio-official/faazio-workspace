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
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import { FIREBASE_AUTH_ENABLED } from '../lib/config';

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

/** Pending native phone verification for the current send→verify round-trip. */
let pending: { phone: string; confirmation: ConfirmationResult } | null = null;

/**
 * Seller onboarding treats the OTP as a digital signature while the shopper is already signed in.
 * Verifying on the primary Firebase app would swap the session to the phone-auth UID, so the
 * signature uses a disposable secondary app instead and leaves the shopper session untouched.
 */
const OTP_APP_NAME = 'faazio-seller-otp';

async function otpAuth() {
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

/** Normalize a 10-digit Indian mobile into E.164 (`+91…`) — Firebase requires a country code. */
export function toE164(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) return `+${clean}`;
  return `+91${clean}`;
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
 * Send (or resend) a 6-digit SMS OTP through the native Firebase SDK. Android may verify
 * automatically without the user typing; iOS falls back to reCAPTCHA without APNs.
 */
export async function sendOtp(phoneDigits: string): Promise<void> {
  if (!firebaseAuthConfigured()) {
    throw new Error('Firebase Auth is not configured.');
  }
  const phone = toE164(phoneDigits);
  try {
    const confirmation = await signInWithPhoneNumber(await otpAuth(), phone);
    pending = { phone, confirmation };
  } catch (err) {
    await disposeOtpApp();
    throw err;
  }
}

/** Verify the SMS code and return the Firebase ID token session. */
export async function verifyOtp(phoneDigits: string, code: string): Promise<FirebaseSession> {
  if (!firebaseAuthConfigured()) {
    throw new Error('Firebase Auth is not configured.');
  }
  const phone = toE164(phoneDigits);
  if (!pending || pending.phone !== phone) {
    throw new Error('No OTP request is pending.');
  }
  const credential = await pending.confirmation.confirm(code);
  pending = null;
  const token = await credential.user.getIdTokenResult();
  const session = toSession(
    credential.user,
    token.token,
    Math.floor(new Date(token.expirationTime).getTime() / 1000),
  );
  await disposeOtpApp();
  return session;
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

/** Display name from the Firebase profile, falling back to the phone (never blank). */
export function displayName(user: FirebaseUser): string {
  return user.displayName || user.phoneNumber || 'Faazio User';
}
