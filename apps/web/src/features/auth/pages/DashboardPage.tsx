import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../../org/org-context';

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
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { currentOrg } = useOrg();
  const [data, setData] = useState<MineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) {
      setData(null);
      return;
    }
    void orgApi<MineResponse>('/dashboards/me')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'));
  }, [currentOrg?.id]);

  return (
    <section className="panel">
      <h1>{data?.dashboard?.name || `Welcome, ${user?.firstName}`}</h1>
      <p className="lede">
        {currentOrg
          ? data?.dashboard?.role
            ? `Role dashboard: ${data.dashboard.role.name}`
            : `Signed in to ${currentOrg.name}`
          : 'Create an organization to unlock your role dashboard.'}
      </p>

      {error && <div className="alert error">{error}</div>}

      {data?.dashboard?.widgets?.length ? (
        <div className="widget-grid">
          {data.dashboard.widgets.map((w) => (
            <article key={w.id} className={`widget widget-${w.type.toLowerCase()}`}>
              <h3>{w.title}</h3>
              {w.type === 'CHART' && Array.isArray(w.config.series) ? (
                <div className="chart-bars">
                  {(w.config.series as Array<{ label: string; value: number }>).map((s) => (
                    <div key={s.label} className="chart-bar-wrap">
                      <div className="chart-bar" style={{ height: `${Math.max(8, s.value * 4)}px` }} />
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{String(w.config.valueLabel || w.config.body || '—')}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No widgets yet for this role.</p>
      )}

      <div className="action-row">
        <Link className="btn secondary" to="/app/sessions">
          Manage sessions
        </Link>
        <button className="btn ghost" type="button" onClick={() => void logout(true)}>
          Log out all devices
        </button>
      </div>
    </section>
  );
}
