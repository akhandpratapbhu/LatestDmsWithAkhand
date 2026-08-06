import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProjectSidebarsResponse, ProjectSidebarDto, SidebarResponse } from '@dms/shared';
import { api, orgApi } from '../../lib/api';
import { useOrg } from '../org/org-context';
import { useAuth } from '../auth/auth-context';

type IamContextValue = {
  sidebar: SidebarResponse | null;
  projectSidebars: ProjectSidebarDto[];
  loading: boolean;
  projectSidebarsLoading: boolean;
  hasPermission: (code: string) => boolean;
  refreshSidebar: () => Promise<void>;
  refreshProjectSidebars: () => Promise<void>;
};

const IamContext = createContext<IamContextValue | null>(null);

export function IamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [sidebar, setSidebar] = useState<SidebarResponse | null>(null);
  const [projectSidebars, setProjectSidebars] = useState<ProjectSidebarDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectSidebarsLoading, setProjectSidebarsLoading] = useState(false);

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

  const refreshProjectSidebars = useCallback(async () => {
    if (!user) {
      setProjectSidebars([]);
      return;
    }
    setProjectSidebarsLoading(true);
    try {
      const data = await api<ProjectSidebarsResponse>('/iam/project-sidebars');
      setProjectSidebars(data.projects ?? []);
    } catch {
      setProjectSidebars([]);
    } finally {
      setProjectSidebarsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    void refreshProjectSidebars();
  }, [refreshProjectSidebars]);

  const hasPermission = useCallback(
    (code: string) => {
      // Configure System operators can manage any project's builders/IAM when needed.
      if (user?.isPlatformAdmin) return true;
      return !!sidebar?.permissions.includes(code);
    },
    [sidebar, user?.isPlatformAdmin],
  );

  const value = useMemo(
    () => ({
      sidebar,
      projectSidebars,
      loading,
      projectSidebarsLoading,
      hasPermission,
      refreshSidebar,
      refreshProjectSidebars,
    }),
    [
      sidebar,
      projectSidebars,
      loading,
      projectSidebarsLoading,
      hasPermission,
      refreshSidebar,
      refreshProjectSidebars,
    ],
  );

  return <IamContext.Provider value={value}>{children}</IamContext.Provider>;
}

export function useIam(): IamContextValue {
  const ctx = useContext(IamContext);
  if (!ctx) throw new Error('useIam must be used within IamProvider');
  return ctx;
}
