import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse, SessionInfo } from '@dms/shared';
import { api, clearTokens, getAccessToken, setTokens } from '../../lib/api';

type AuthContextValue = {
  user: AuthUser | null;
  bootstrapping: boolean;
  login: (email: string, password: string, deviceName?: string) => Promise<void>;
  loginWithOtp: (email: string, otp: string, deviceName?: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    const me = await api<AuthUser>('/auth/me');
    setUser(me);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (getAccessToken()) {
          await refreshMe();
        }
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [refreshMe]);

  const applyLogin = useCallback((result: LoginResponse) => {
    setTokens(result.tokens.accessToken, result.tokens.refreshToken);
    setUser(result.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string, deviceName?: string) => {
      const result = await api<LoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, deviceName }),
        },
        false,
      );
      applyLogin(result);
    },
    [applyLogin],
  );

  const loginWithOtp = useCallback(
    async (email: string, otp: string, deviceName?: string) => {
      const result = await api<LoginResponse>(
        '/auth/otp/verify',
        {
          method: 'POST',
          body: JSON.stringify({ email, otp, deviceName }),
        },
        false,
      );
      applyLogin(result);
    },
    [applyLogin],
  );

  const logout = useCallback(async (allDevices = false) => {
    try {
      await api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: localStorage.getItem('configure_refresh_token')
            ?? localStorage.getItem('dms_refresh_token'),
          allDevices,
        }),
      });
    } catch {
      // still clear local session
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, bootstrapping, login, loginWithOtp, logout, refreshMe }),
    [user, bootstrapping, login, loginWithOtp, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export async function fetchSessions(): Promise<SessionInfo[]> {
  return api<SessionInfo[]>('/auth/sessions');
}

export async function revokeSession(id: string): Promise<void> {
  await api(`/auth/sessions/${id}`, { method: 'DELETE' });
}
