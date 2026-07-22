import { FormEvent, useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';

type DashboardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roleId: string | null;
  isDefault: boolean;
  isLanding: boolean;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
  }>;
  role?: { name: string; code: string } | null;
};

type RoleRow = { id: string; name: string; code: string };

export function DashboardsAdminPage() {
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', roleId: '', description: '' });
  const [widgetForm, setWidgetForm] = useState({
    type: 'CARD',
    title: '',
    chartType: 'bar',
  });

  async function load() {
    if (!currentOrg) return;
    const [d, r] = await Promise.all([
      orgApi<DashboardRow[]>('/dashboards'),
      orgApi<RoleRow[]>('/iam/roles'),
    ]);
    setDashboards(d);
    setRoles(r);
    if (!selectedId && d[0]) setSelectedId(d[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  const selected = dashboards.find((d) => d.id === selectedId) ?? null;

  async function createDashboard(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await orgApi<DashboardRow>('/dashboards', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || undefined,
          roleId: form.roleId || undefined,
          isDefault: true,
        }),
      });
      setMessage('Dashboard created');
      setForm({ name: '', slug: '', roleId: '', description: '' });
      await load();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function addWidget(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const config =
      widgetForm.type === 'CHART'
        ? {
            chartType: widgetForm.chartType,
            series: [
              { label: 'A', value: 10 },
              { label: 'B', value: 16 },
              { label: 'C', value: 8 },
            ],
          }
        : widgetForm.type === 'CARD'
          ? { metric: 'custom', valueLabel: widgetForm.title }
          : { body: 'Custom widget content' };

    try {
      await orgApi(`/dashboards/${selected.id}/widgets`, {
        method: 'POST',
        body: JSON.stringify({
          type: widgetForm.type,
          title: widgetForm.title,
          config,
        }),
      });
      setWidgetForm({ type: 'CARD', title: '', chartType: 'bar' });
      setMessage('Widget added');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function setLanding() {
    if (!selected?.roleId) {
      setError('Select a role-linked dashboard to set landing');
      return;
    }
    await orgApi('/dashboards/landings', {
      method: 'POST',
      body: JSON.stringify({
        roleId: selected.roleId,
        dashboardId: selected.id,
        path: '/app',
      }),
    });
    setMessage('Landing page set for role');
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Dashboards</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!hasPermission('screen.dashboards') && !hasPermission('menu.dashboards')) {
    return (
      <section className="panel">
        <h1>Dashboards</h1>
        <div className="alert error">Not authorized to manage dashboards.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Dashboard builder</h1>
      <p className="lede">Create role-specific dashboards with cards, charts, and landing pages.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void createDashboard(e)}>
        <h2>New dashboard</h2>
        <div className="row-2">
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Slug
            <input
              required
              pattern="[a-z0-9-]+"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Role
          <select
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          >
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" type="submit">
          Create dashboard
        </button>
      </form>

      <label className="inline-field">
        Edit dashboard
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {dashboards.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.role ? `(${d.role.code})` : ''}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <>
          <div className="action-row">
            <button className="btn secondary" type="button" onClick={() => void setLanding()}>
              Set as role landing
            </button>
          </div>

          <form className="auth-form compact" onSubmit={(e) => void addWidget(e)}>
            <h2>Add widget</h2>
            <div className="row-2">
              <label>
                Type
                <select
                  value={widgetForm.type}
                  onChange={(e) => setWidgetForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="CARD">CARD</option>
                  <option value="CHART">CHART</option>
                  <option value="TEXT">TEXT</option>
                  <option value="TABLE">TABLE</option>
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  value={widgetForm.title}
                  onChange={(e) => setWidgetForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
            </div>
            <button className="btn secondary" type="submit">
              Add widget
            </button>
          </form>

          <div className="widget-grid">
            {selected.widgets.map((w) => (
              <article key={w.id} className={`widget widget-${w.type.toLowerCase()}`}>
                <h3>{w.title}</h3>
                <p className="muted tiny">{w.type}</p>
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
        </>
      )}
    </section>
  );
}
