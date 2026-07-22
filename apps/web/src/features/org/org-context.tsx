import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OrganizationDto } from '@dms/shared';
import { api, getOrganizationId, setOrganizationId } from '../../lib/api';
import { useAuth } from '../auth/auth-context';

type OrgContextValue = {
  organizations: OrganizationDto[];
  currentOrg: OrganizationDto | null;
  loading: boolean;
  refreshOrgs: () => Promise<void>;
  selectOrg: (id: string) => void;
  createOrg: (name: string, code?: string) => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      return;
    }
    setLoading(true);
    try {
      const list = await api<OrganizationDto[]>('/organizations');
      setOrganizations(list);
      const saved = getOrganizationId();
      const selected = list.find((o) => o.id === saved) ?? list[0] ?? null;
      setCurrentOrg(selected);
      setOrganizationId(selected?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshOrgs();
  }, [refreshOrgs]);

  const selectOrg = useCallback(
    (id: string) => {
      const found = organizations.find((o) => o.id === id) ?? null;
      setCurrentOrg(found);
      setOrganizationId(found?.id ?? null);
    },
    [organizations],
  );

  const createOrg = useCallback(
    async (name: string, code?: string) => {
      const created = await api<OrganizationDto>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, code }),
      });
      setOrganizationId(created.id);
      await refreshOrgs();
    },
    [refreshOrgs],
  );

  const value = useMemo(
    () => ({ organizations, currentOrg, loading, refreshOrgs, selectOrg, createOrg }),
    [organizations, currentOrg, loading, refreshOrgs, selectOrg, createOrg],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
