/**
 * Session token + profile storage backed by the platform Keychain/Keystore
 * (`react-native-keychain`). Values are encrypted at rest; the encryption key
 * lives in the Keystore and is never included in Android backups.
 *
 * The whole session is stored as one generic-password payload under a single
 * service so a read/write is atomic and there are no partial sessions.
 *
 * A module-level cache mirrors the last read/written payload so GatewayClient can
 * read `getAccessToken()` on every request without a Keychain round-trip. It is
 * updated on save/clear and dropped when a stored payload fails its shape check.
 */
import * as Keychain from 'react-native-keychain';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface StoredSession {
  accessToken: string | null;
  user: StoredUser;
}

const SERVICE = 'com.faazio.session';
const ACCOUNT = 'session';

const OPTIONS: Keychain.SetOptions = {
  service: SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
};

/** Last known session; `undefined` = never read, `null` = known signed-out. */
let cache: StoredSession | null | undefined;

function valid(session: unknown): session is StoredSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as StoredSession;
  return !!s.user && typeof s.user.id === 'string';
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(session), OPTIONS);
  cache = session;
}

export async function loadSession(): Promise<StoredSession | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credentials || !credentials.password) {
    cache = null;
    return null;
  }

  try {
    const session = JSON.parse(credentials.password) as StoredSession;
    if (!valid(session)) {
      cache = null;
      return null;
    }
    const normalized: StoredSession = {
      accessToken: session.accessToken ?? null,
      user: session.user,
    };
    cache = normalized;
    return normalized;
  } catch {
    cache = null;
    return null;
  }
}

/**
 * Cached access token for per-request auth. Reads the Keychain once, then serves
 * from memory; updated automatically by saveSession/updateSessionTokens/clearSession.
 */
export async function getAccessToken(): Promise<string | null> {
  if (cache === undefined) await loadSession();
  return cache?.accessToken ?? null;
}

/**
 * Persist a refreshed access token without touching the profile. Firebase rotates ID tokens
 * natively, so there is no refresh token to store.
 */
export async function updateSessionTokens(accessToken: string): Promise<StoredSession | null> {
  if (cache === undefined) await loadSession();
  if (!cache) return null;
  const next: StoredSession = { ...cache, accessToken };
  await saveSession(next);
  return next;
}

export async function clearSession(): Promise<void> {
  cache = null;
  await Keychain.resetGenericPassword({ service: SERVICE });
}
