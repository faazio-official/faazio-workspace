import { create } from 'zustand';
import {
  clearSession,
  loadSession,
  saveSession,
  StoredSession,
  updateSessionTokens,
} from '@/services/secureSession';
import { signOutRemote } from '@/services/firebaseAuth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface LoginPayload {
  user: AuthUser;
  accessToken?: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  hydrated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  /** Persist a refreshed Firebase ID token (Keychain stays the single owner). */
  updateTokens: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  accessToken: null,
  hydrated: false,
  login: async (payload) => {
    const session: StoredSession = {
      accessToken: payload.accessToken ?? null,
      user: payload.user,
    };
    await saveSession(session);
    set({
      isAuthenticated: true,
      user: payload.user,
      accessToken: session.accessToken,
    });
  },
  updateTokens: async (accessToken) => {
    const session = await updateSessionTokens(accessToken);
    if (session) set({ accessToken: session.accessToken });
  },
  logout: async () => {
    // Best-effort native Firebase sign-out before dropping the local session (never blocks).
    await signOutRemote();
    await clearSession();
    set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
    });
  },
  hydrate: async () => {
    try {
      const session = await loadSession();
      if (session) {
        set({
          isAuthenticated: true,
          user: session.user,
          accessToken: session.accessToken,
        });
        return true;
      }
      return false;
    } finally {
      set({ hydrated: true });
    }
  },
}));
