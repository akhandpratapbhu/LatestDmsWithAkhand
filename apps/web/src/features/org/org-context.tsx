import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DeleteOrganizationResultDto, OrganizationDto, ProjectStatus } from '@dms/shared';
import { api, getOrganizationId, setOrganizationId } from '../../lib/api';
import { useAuth } from '../auth/auth-context';

export type CreateProjectInput = {
  name: string;
  code?: string;
  description?: string;
  logoUrl?: string;
  theme?: string;
  currency?: string;
  language?: string;
  timezone?: string;
  subdomain?: string;
  status?: ProjectStatus;
  version?: string;
  databaseName?: string;
  enabledFeatures?: string[];
  /** Required: single project admin who owns IAM + features inside the project. */
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  /** Optional — API auto-generates when omitted. */
  adminPassword?: string;
};

type OrgContextValue = {
  organizations: OrganizationDto[];
  currentOrg: OrganizationDto | null;
  loading: boolean;
  refreshOrgs: (preferOrganizationId?: string | null) => Promise<void>;
  selectOrg: (id: string) => void;
  createOrg: (
    input: CreateProjectInput | string,
    code?: string,
  ) => Promise<OrganizationDto>;
  deleteOrg: (
    id: string,
    opts?: { force?: boolean },
  ) => Promise<DeleteOrganizationResultDto>;
  patchCurrentOrg: (org: OrganizationDto) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrganizationDto | null>(null);
  /** Start true when signed in so project-slug guards wait for the first org fetch. */
  const [loading, setLoading] = useState(() => Boolean(user));

  const refreshOrgs = useCallback(async (preferOrganizationId?: string | null) => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      return;
    }
    setLoading(true);
    try {
      const list = await api<OrganizationDto[]>('/organizations');
      setOrganizations(list);
      const preferred =
        preferOrganizationId?.trim() || getOrganizationId() || null;
      const selected =
        (preferred ? list.find((o) => o.id === preferred) : undefined) ??
        list[0] ??
        null;
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

  const patchCurrentOrg = useCallback((org: OrganizationDto) => {
    setOrganizations((prev) => prev.map((o) => (o.id === org.id ? { ...o, ...org } : o)));
    setCurrentOrg((prev) => (prev?.id === org.id ? { ...prev, ...org } : prev));
  }, []);

  const createOrg = useCallback(
    async (input: CreateProjectInput | string, code?: string) => {
      const body: CreateProjectInput =
        typeof input === 'string' ? { name: input, code } : input;
      const created = await api<OrganizationDto>('/organizations', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setOrganizationId(created.id);
      await refreshOrgs();
      return created;
    },
    [refreshOrgs],
  );

  const deleteOrg = useCallback(
    async (id: string, opts?: { force?: boolean }) => {
      const qs = opts?.force ? '?force=true' : '';
      const result = await api<DeleteOrganizationResultDto>(`/organizations/${id}${qs}`, {
        method: 'DELETE',
      });
      if (getOrganizationId() === id) {
        setOrganizationId(null);
      }
      setOrganizations((prev) => prev.filter((o) => o.id !== id));
      setCurrentOrg((prev) => (prev?.id === id ? null : prev));
      await refreshOrgs();
      return result;
    },
    [refreshOrgs],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrg,
      loading,
      refreshOrgs,
      selectOrg,
      createOrg,
      deleteOrg,
      patchCurrentOrg,
    }),
    [
      organizations,
      currentOrg,
      loading,
      refreshOrgs,
      selectOrg,
      createOrg,
      deleteOrg,
      patchCurrentOrg,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
