import * as SecureStore from 'expo-secure-store';

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

const ACCESS_TOKEN_KEY = 'faazio.session.accessToken';
const REFRESH_TOKEN_KEY = 'faazio.session.refreshToken';
const PROFILE_KEY = 'faazio.session.profile';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export async function saveSession(session: StoredSession): Promise<void> {
  if (session.accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken, OPTIONS);
  }
  if (session.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken, OPTIONS);
  }
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(session.user), OPTIONS);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, profileRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY, OPTIONS),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
    SecureStore.getItemAsync(PROFILE_KEY, OPTIONS),
  ]);

  if (!profileRaw) return null;

  try {
    const user = JSON.parse(profileRaw) as StoredUser;
    if (!user || typeof user !== 'object' || typeof user.id !== 'string') {
      return null;
    }
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(PROFILE_KEY, OPTIONS),
  ]);
}
