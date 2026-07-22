import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SidebarResponse } from '@dms/shared';
import { orgApi } from '../../lib/api';
import { useOrg } from '../org/org-context';

type IamContextValue = {
  sidebar: SidebarResponse | null;
  loading: boolean;
  hasPermission: (code: string) => boolean;
  refreshSidebar: () => Promise<void>;
};

const IamContext = createContext<IamContextValue | null>(null);

export function IamProvider({ children }: { children: ReactNode }) {
  const { currentOrg } = useOrg();
  const [sidebar, setSidebar] = useState<SidebarResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSidebar = useCallback(async () => {
    if (!currentOrg) {
      setSidebar(null);
      return;
    }
    setLoading(true);
    try {
      const data = await orgApi<SidebarResponse>('/iam/sidebar');
      setSidebar(data);
    } catch {
      setSidebar(null);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    void refreshSidebar();
  }, [refreshSidebar]);

  const hasPermission = useCallback(
    (code: string) => !!sidebar?.permissions.includes(code),
    [sidebar],
  );

  const value = useMemo(
    () => ({ sidebar, loading, hasPermission, refreshSidebar }),
    [sidebar, loading, hasPermission, refreshSidebar],
  );

  return <IamContext.Provider value={value}>{children}</IamContext.Provider>;
}

export function useIam(): IamContextValue {
  const ctx = useContext(IamContext);
  if (!ctx) throw new Error('useIam must be used within IamProvider');
  return ctx;
}
