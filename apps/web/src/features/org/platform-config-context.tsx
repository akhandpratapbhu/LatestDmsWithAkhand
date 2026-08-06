import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_PLATFORM_ENABLED_FEATURES,
  type PlatformConfigDto,
} from '@dms/shared';
import { api } from '../../lib/api';
import { useAuth } from '../auth/auth-context';

type PlatformConfigContextValue = {
  config: PlatformConfigDto | null;
  enabledFeatures: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  setConfig: (config: PlatformConfigDto) => void;
};

const PlatformConfigContext = createContext<PlatformConfigContextValue | null>(null);

export function PlatformConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfigState] = useState<PlatformConfigDto | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setConfigState(null);
      return;
    }
    setLoading(true);
    try {
      const next = await api<PlatformConfigDto>('/platform/config');
      setConfigState(next);
    } catch {
      setConfigState({
        id: 'default',
        enabledFeatures: [...DEFAULT_PLATFORM_ENABLED_FEATURES],
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setConfig = useCallback((next: PlatformConfigDto) => {
    setConfigState(next);
  }, []);

  const value = useMemo<PlatformConfigContextValue>(
    () => ({
      config,
      enabledFeatures: config?.enabledFeatures ?? DEFAULT_PLATFORM_ENABLED_FEATURES,
      loading,
      refresh,
      setConfig,
    }),
    [config, loading, refresh, setConfig],
  );

  return (
    <PlatformConfigContext.Provider value={value}>{children}</PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig(): PlatformConfigContextValue {
  const ctx = useContext(PlatformConfigContext);
  if (!ctx) {
    throw new Error('usePlatformConfig must be used within PlatformConfigProvider');
  }
  return ctx;
}
