/**
 * Human copy for Firebase phone-auth failures.
 *
 * The native SDK rejects with a `NativeFirebaseError` whose `message` is `[auth/<code>] <sdk text>`.
 * Rendering that string — as the OTP screens used to — leaks SDK internals such as
 * `[auth/session-expired] The sms code has expired...`. Read the stable `code` instead and map it to
 * actionable copy; callers pass a context-appropriate `fallback` for unknown codes.
 */

const OTP_ERROR_COPY: Record<string, string> = {
  'auth/session-expired': 'That code has expired. Tap "Resend OTP" to get a new one.',
  'auth/code-expired': 'That code has expired. Tap "Resend OTP" to get a new one.',
  'auth/invalid-verification-id': 'This verification is no longer valid. Tap "Resend OTP".',
  'auth/invalid-verification-code': 'That code is not right. Check the 6 digits and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute, then try again.',
  'auth/quota-exceeded': 'We cannot send more codes right now. Try again later.',
  'auth/invalid-phone-number': 'That phone number does not look right.',
  'auth/missing-phone-number': 'Enter your phone number to continue.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/missing-client-identifier': 'This build cannot verify numbers. Use a Play Store install.',
  'auth/invalid-app-credential': 'This build cannot verify numbers. Use a Play Store install.',
  'auth/app-not-authorized': 'This build cannot verify numbers. Use a Play Store install.',
  // Local guard in `services/firebaseAuth.ts`: the native promise exceeded its hard ceiling
  // (a stuck reCAPTCHA presentation must never leave the UI spinning forever).
  'faazio/otp-timeout': 'Verification timed out. Check your connection and try again.',
};

/** The Firebase auth error code (`auth/<reason>`), from `err.code` or parsed out of `err.message`. */
export function otpErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && code) return code.toLowerCase();
  const message = (err as { message?: unknown }).message;
  if (typeof message === 'string') {
    const match = message.match(/\[(auth\/[a-z0-9-]+)\]/i);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/** User-facing copy for a Firebase phone-auth failure, falling back to caller-supplied copy. */
export function otpErrorMessage(err: unknown, fallback: string): string {
  const code = otpErrorCode(err);
  return (code && OTP_ERROR_COPY[code]) || fallback;
}

/** True when the verification session is dead, so only a fresh send (resend) can recover it. */
export function isOtpSessionExpired(err: unknown): boolean {
  const code = otpErrorCode(err);
  return (
    code === 'auth/session-expired' ||
    code === 'auth/code-expired' ||
    code === 'auth/invalid-verification-id'
  );
}
