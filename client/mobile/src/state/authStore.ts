import { create } from 'zustand';
import {
  clearSession,
  getAccessToken,
  loadSession,
  saveSession,
  StoredSession,
  updateSessionTokens,
} from '@/services/secureSession';
import { signOutRemote } from '@/services/supabaseAuth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface LoginPayload {
  user: AuthUser;
  accessToken?: string | null;
  refreshToken?: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  /** Persist a rotated GoTrue token pair after a silent refresh (Keychain stays the single owner). */
  updateTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  login: async (payload) => {
    const session: StoredSession = {
      accessToken: payload.accessToken ?? null,
      refreshToken: payload.refreshToken ?? null,
      user: payload.user,
    };
    await saveSession(session);
    set({
      isAuthenticated: true,
      user: payload.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  },
  updateTokens: async (accessToken, refreshToken) => {
    const session = await updateSessionTokens(accessToken, refreshToken);
    if (session) set({ accessToken: session.accessToken, refreshToken: session.refreshToken });
  },
  logout: async () => {
    // Best-effort remote revoke before dropping the local session (never blocks sign-out).
    await signOutRemote(await getAccessToken());
    await clearSession();
    set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
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
          refreshToken: session.refreshToken,
        });
        return true;
      }
      return false;
    } finally {
      set({ hydrated: true });
    }
  },
}));
