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
  /** Partner role claim (SELLER | DISTRICT_ADMIN | SUPER_ADMIN), decoded from the ID token. */
  role?: string;
  /** Partner district scope claim (3-letter code, e.g. TCH). */
  districtCode?: string;
  /** Legacy parent state scope claim (2-letter code) — district admins also carry it. */
  stateCode?: string;
  /** Seller claim for SELLER logins. */
  sellerId?: string;
}

export function isDistrictAdmin(user: AuthUser | null): boolean {
  return user?.role === 'DISTRICT_ADMIN';
}

export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function isPartnerAdmin(user: AuthUser | null): boolean {
  return isDistrictAdmin(user) || isSuperAdmin(user);
}

export interface LoginPayload {
  user: AuthUser;
  accessToken?: string | null;
  /** Portal refresh token (seller/admin web-credential login); absent for Firebase sessions. */
  refreshToken?: string | null;
}

/**
 * Customer + delivery app session. The seller product does NOT use this store: its WebView shell
 * loads the web partner portal, which owns the seller session in HttpOnly cookies. Never add a
 * seller login path here (that would reintroduce a second, divergent session authority).
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  hydrated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  /** Persist a refreshed Firebase ID token (Keychain stays the single owner). */
  updateTokens: (accessToken: string) => Promise<void>;
  /** Drop in-memory auth after GatewayClient already cleared the Keychain (dead session). */
  expireSession: () => void;
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
      refreshToken: payload.refreshToken ?? null,
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
  expireSession: () => {
    set({ isAuthenticated: false, user: null, accessToken: null });
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
