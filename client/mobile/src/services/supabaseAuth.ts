/**
 * Minimal Supabase Auth (GoTrue) REST client for phone OTP — no SDK, keeping the bundle lean
 * (AGENTS: lightweight). The anon key is public by design; the access token it returns is the
 * same bearer the Go gateway verifies (internal/platform/auth claimsFromRequest).
 *
 * Flow: sendOtp(phone) → user enters the 6-digit SMS code → verifyOtp(phone, code) returns a real
 * session {access_token, refresh_token, user}. refreshSession() rotates an expired token; a
 * single-flight guard prevents concurrent 401 recovery from double-refreshing (GoTrue rotates the
 * refresh token, so a second concurrent refresh would invalidate the first).
 *
 * Never logs tokens, phone numbers or OTP codes.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/config';

export interface GoTrueUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  user: GoTrueUser;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: GoTrueUser;
}

export function supabaseAuthConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/** Normalize a 10-digit Indian mobile into E.164 (`+91…`) — GoTrue requires a country code. */
export function toE164(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) return `+${clean}`;
  return `+91${clean}`;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (!supabaseAuthConfigured()) {
    throw new Error('Supabase Auth is not configured.');
  }
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // GoTrue error bodies carry a machine code + message; surface a safe, generic message only.
    throw new Error(res.status === 429 ? 'Too many attempts. Try again shortly.' : 'Verification failed.');
  }
  return (await res.json()) as T;
}

function toSession(token: TokenResponse): SupabaseSession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + token.expires_in,
    user: token.user,
  };
}

/** Send (or resend) a 6-digit SMS OTP. Creates the Supabase user on first send. */
export async function sendOtp(phoneDigits: string): Promise<void> {
  await post<Record<string, unknown>>('/auth/v1/otp', {
    phone: toE164(phoneDigits),
    create_user: true,
  });
}

/** Verify the SMS OTP and return a real session (throws on an invalid/expired code). */
export async function verifyOtp(phoneDigits: string, code: string): Promise<SupabaseSession> {
  const token = await post<TokenResponse>('/auth/v1/verify', {
    phone: toE164(phoneDigits),
    token: code,
    type: 'sms',
  });
  return toSession(token);
}

let refreshInFlight: Promise<SupabaseSession | null> | null = null;

/** Rotate an expired access token. Returns null when the refresh token is itself dead. */
export async function refreshSession(refreshToken: string): Promise<SupabaseSession | null> {
  if (!refreshToken || !supabaseAuthConfigured()) return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const token = await post<TokenResponse>('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: refreshToken,
      });
      return toSession(token);
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Best-effort remote sign-out; the local Keychain session is cleared regardless by the caller. */
export async function signOutRemote(accessToken: string | null): Promise<void> {
  if (!accessToken || !supabaseAuthConfigured()) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { ...authHeaders(), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // best-effort
  }
}

/** Display name from GoTrue metadata, falling back to the phone (never blank). */
export function displayName(user: GoTrueUser): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta['full_name'] === 'string' ? meta['full_name'] : '';
  return full || user.phone || 'Faazio User';
}
