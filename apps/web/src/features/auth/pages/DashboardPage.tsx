import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../../org/org-context';
import { PageHeader } from '../../../components/PageHeader';
import { DashboardWidgetCard } from '../../dashboards/components/DashboardWidgetCard';
import {
  HospitalDashboardStats,
  SchoolDashboardStats,
} from '../../dashboards/live-data';

type MineResponse = {
  landingPath: string;
  dashboard: {
    id: string;
    name: string;
    description: string | null;
    widgets: Array<{
      id: string;
      type: string;
      title: string;
      config: Record<string, unknown>;
    }>;
    role?: { name: string; code: string } | null;
  } | null;
  role?: { name: string; code: string } | null;
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { currentOrg } = useOrg();
  const href = useWorkspaceHref();
  const [data, setData] = useState<MineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hospitalLive, setHospitalLive] = useState<HospitalDashboardStats | null>(null);
  const [schoolLive, setSchoolLive] = useState<SchoolDashboardStats | null>(null);

  const isHospital = useMemo(
    () =>
      Boolean(
        currentOrg?.slug?.includes('hospital') ||
          currentOrg?.name?.toLowerCase().includes('hospital'),
      ),
    [currentOrg?.slug, currentOrg?.name],
  );
  const isSchool = useMemo(
    () =>
      Boolean(
        currentOrg?.slug?.includes('school') ||
          currentOrg?.name?.toLowerCase().includes('school'),
      ),
    [currentOrg?.slug, currentOrg?.name],
  );

  useEffect(() => {
    if (!currentOrg) {
      setData(null);
      return;
    }
    void orgApi<MineResponse>('/dashboards/me')
      .then(async (mine) => {
        setData(mine);
        const widgets = mine.dashboard?.widgets ?? [];
        const needsHospital = widgets.some((w) =>
          String(w.config.dataSource ?? '').startsWith('hospital.'),
        );
        const needsSchool = widgets.some((w) =>
          String(w.config.dataSource ?? '').startsWith('school.'),
        );
        if (needsHospital || isHospital) {
          try {
            setHospitalLive(await orgApi<HospitalDashboardStats>('/hospital/dashboard-stats'));
          } catch {
            setHospitalLive(null);
          }
        }
        if (needsSchool || isSchool) {
          try {
            setSchoolLive(await orgApi<SchoolDashboardStats>('/school/dashboard-stats'));
          } catch {
            setSchoolLive(null);
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'));
  }, [currentOrg?.id, isHospital, isSchool]);

  const roleLabel =
    data?.dashboard?.role?.name || data?.role?.name
      ? `Role dashboard · ${data?.dashboard?.role?.name || data?.role?.name}`
      : currentOrg
        ? `Signed in to ${currentOrg.name}`
        : 'Create a project to unlock your role dashboard.';

  return (
    <div>
      <PageHeader
        title={data?.dashboard?.name || `Welcome, ${user?.firstName}`}
        description={roleLabel}
        actions={
          <>
            <Link className="btn secondary" to={href('/app/sessions')}>
              Sessions
            </Link>
            <button className="btn ghost" type="button" onClick={() => void logout(true)}>
              Log out all devices
            </button>
          </>
        }
      />

      {error && <div className="alert error">{error}</div>}

      {data?.dashboard?.widgets?.length ? (
        <div className="widget-grid">
          {data.dashboard.widgets.map((w) => (
            <DashboardWidgetCard
              key={w.id}
              widget={w}
              live={{ hospital: hospitalLive, school: schoolLive }}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No widgets configured</strong>
          Ask an admin to assign a dashboard for your role.
        </div>
      )}
    </div>
  );
}
