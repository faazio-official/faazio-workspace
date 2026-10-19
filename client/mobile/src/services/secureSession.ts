/**
 * Session token + profile storage backed by the platform Keychain/Keystore
 * (`react-native-keychain`). Values are encrypted at rest; the encryption key
 * lives in the Keystore and is never included in Android backups.
 *
 * The whole session is stored as one generic-password payload under a single
 * service so a read/write is atomic and there are no partial sessions.
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
  refreshToken: string | null;
  user: StoredUser;
}

const SERVICE = 'com.faazio.session';
const ACCOUNT = 'session';

const OPTIONS: Keychain.SetOptions = {
  service: SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
};

export async function saveSession(session: StoredSession): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(session), OPTIONS);
}

export async function loadSession(): Promise<StoredSession | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credentials || !credentials.password) return null;

  try {
    const session = JSON.parse(credentials.password) as StoredSession;
    if (
      !session ||
      typeof session !== 'object' ||
      !session.user ||
      typeof session.user.id !== 'string'
    ) {
      return null;
    }
    return {
      accessToken: session.accessToken ?? null,
      refreshToken: session.refreshToken ?? null,
      user: session.user,
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
