import { FormEvent, useEffect, useMemo, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { DashboardWidgetCard } from '../components/DashboardWidgetCard';
import {
  HOSPITAL_DATA_SOURCES,
  SCHOOL_DATA_SOURCES,
  HospitalDashboardStats,
  SchoolDashboardStats,
} from '../live-data';

type DashboardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roleId: string | null;
  isDefault: boolean;
  isLanding: boolean;
  updatedAt?: string;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    config: Record<string, unknown>;
    width: number;
    height: number;
  }>;
  role?: { id: string; name: string; code: string } | null;
  _count?: { widgets: number };
};

type RoleRow = { id: string; name: string; code: string };

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatUpdated(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function DashboardsAdminPage() {
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
  const [dashboards, setDashboards] = useState<DashboardRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', roleId: '', description: '' });
  const [metaForm, setMetaForm] = useState({ name: '', description: '', roleId: '' });
  const [widgetForm, setWidgetForm] = useState({
    type: 'CARD',
    title: '',
    dataSource: '',
    formCode: '',
    body: '',
  });
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

  const dataSources = [
    ...(isHospital ? HOSPITAL_DATA_SOURCES : []),
    ...(isSchool ? SCHOOL_DATA_SOURCES : []),
    ...(!isHospital && !isSchool ? [...HOSPITAL_DATA_SOURCES, ...SCHOOL_DATA_SOURCES] : []),
  ];

  async function load() {
    if (!currentOrg) return;
    const [d, r] = await Promise.all([
      orgApi<DashboardRow[]>('/dashboards'),
      orgApi<RoleRow[]>('/iam/roles'),
    ]);
    setDashboards(d);
    setRoles(r);

    if (isHospital) {
      try {
        setHospitalLive(await orgApi<HospitalDashboardStats>('/hospital/dashboard-stats'));
      } catch {
        setHospitalLive(null);
      }
    }
    if (isSchool) {
      try {
        setSchoolLive(await orgApi<SchoolDashboardStats>('/school/dashboard-stats'));
      } catch {
        setSchoolLive(null);
      }
    }
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id, isHospital, isSchool]);

  const editing = dashboards.find((d) => d.id === editingId) ?? null;

  useEffect(() => {
    if (editing) {
      setMetaForm({
        name: editing.name,
        description: editing.description ?? '',
        roleId: editing.roleId ?? '',
      });
    }
  }, [editing?.id]);

  async function createDashboard(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await orgApi<DashboardRow>('/dashboards', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          description: form.description || undefined,
          roleId: form.roleId || undefined,
          isDefault: true,
          isLanding: Boolean(form.roleId),
        }),
      });
      if (form.roleId) {
        await orgApi('/dashboards/landings', {
          method: 'POST',
          body: JSON.stringify({
            roleId: form.roleId,
            dashboardId: created.id,
            path: '/app',
          }),
        });
      }
      setMessage('Dashboard created');
      setForm({ name: '', slug: '', roleId: '', description: '' });
      setShowCreate(false);
      await load();
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await orgApi(`/dashboards/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: metaForm.name,
          description: metaForm.description || undefined,
          roleId: metaForm.roleId || null,
          isLanding: Boolean(metaForm.roleId),
        }),
      });
      if (metaForm.roleId) {
        await orgApi('/dashboards/landings', {
          method: 'POST',
          body: JSON.stringify({
            roleId: metaForm.roleId,
            dashboardId: editing.id,
            path: '/app',
          }),
        });
      }
      setMessage('Dashboard updated');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function addWidget(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;

    const config: Record<string, unknown> = {};
    if (widgetForm.dataSource) {
      config.dataSource = widgetForm.dataSource;
      if (widgetForm.dataSource === 'school.formCount' && widgetForm.formCode) {
        config.formCode = widgetForm.formCode;
      }
      config.valueLabel = '…';
    } else if (widgetForm.type === 'CHART') {
      config.chartType = 'bar';
      config.series = [
        { label: 'A', value: 10 },
        { label: 'B', value: 16 },
        { label: 'C', value: 8 },
      ];
    } else if (widgetForm.type === 'TEXT') {
      config.body = widgetForm.body || widgetForm.title;
    } else if (widgetForm.type === 'TABLE' || widgetForm.dataSource?.includes('upcoming')) {
      config.dataSource = widgetForm.dataSource || undefined;
      config.body = 'List widget';
    } else {
      config.metric = 'custom';
      config.valueLabel = widgetForm.title;
    }

    const type =
      widgetForm.dataSource === 'hospital.upcomingAppointments' ? 'TABLE' : widgetForm.type;

    try {
      await orgApi(`/dashboards/${editing.id}/widgets`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: widgetForm.title,
          config,
          sortOrder: editing.widgets.length + 1,
        }),
      });
      setWidgetForm({ type: 'CARD', title: '', dataSource: '', formCode: '', body: '' });
      setMessage('Widget added');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function removeWidget(widgetId: string) {
    try {
      await orgApi(`/dashboards/widgets/${widgetId}`, { method: 'DELETE' });
      setMessage('Widget removed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Dashboard builder</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  if (!hasPermission('screen.dashboards') && !hasPermission('menu.dashboards')) {
    return (
      <section className="panel">
        <h1>Dashboard builder</h1>
        <div className="alert error">Not authorized to manage dashboards.</div>
      </section>
    );
  }

  if (editing) {
    return (
      <div>
        <PageHeader
          title={`Edit · ${editing.name}`}
          description={
            editing.role
              ? `Role landing · ${editing.role.name} (${editing.role.code})`
              : 'Update widgets and role landing for this dashboard'
          }
          actions={
            <button className="btn secondary" type="button" onClick={() => setEditingId(null)}>
              ← Back to grid
            </button>
          }
        />

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <form className="auth-form compact" onSubmit={(e) => void saveMeta(e)}>
          <h2>Dashboard details</h2>
          <div className="row-2">
            <label>
              Name
              <input
                required
                value={metaForm.name}
                onChange={(e) => setMetaForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              Role (landing)
              <select
                value={metaForm.roleId}
                onChange={(e) => setMetaForm((f) => ({ ...f, roleId: e.target.value }))}
              >
                <option value="">None</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <input
              value={metaForm.description}
              onChange={(e) => setMetaForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <button className="btn primary" type="submit">
            Save details
          </button>
        </form>

        <form className="auth-form compact" onSubmit={(e) => void addWidget(e)}>
          <h2>Add widget</h2>
          <div className="row-2">
            <label>
              Type
              <select
                value={widgetForm.type}
                onChange={(e) => setWidgetForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="CARD">Stat card</option>
                <option value="TABLE">List / table</option>
                <option value="CHART">Chart</option>
                <option value="TEXT">Text</option>
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
          <label>
            Live data source
            <select
              value={widgetForm.dataSource}
              onChange={(e) => setWidgetForm((f) => ({ ...f, dataSource: e.target.value }))}
            >
              <option value="">Static / none</option>
              {dataSources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {widgetForm.dataSource === 'school.formCount' && (
            <label>
              Form code
              <input
                placeholder="e.g. STUDENT_REG"
                value={widgetForm.formCode}
                onChange={(e) => setWidgetForm((f) => ({ ...f, formCode: e.target.value }))}
              />
            </label>
          )}
          {widgetForm.type === 'TEXT' && !widgetForm.dataSource && (
            <label>
              Body
              <input
                value={widgetForm.body}
                onChange={(e) => setWidgetForm((f) => ({ ...f, body: e.target.value }))}
              />
            </label>
          )}
          <button className="btn secondary" type="submit">
            Add widget
          </button>
        </form>

        <div className="widget-grid">
          {editing.widgets.map((w) => (
            <DashboardWidgetCard
              key={w.id}
              widget={w}
              live={{ hospital: hospitalLive, school: schoolLive }}
              showMeta
              onDelete={() => void removeWidget(w.id)}
            />
          ))}
        </div>
        {!editing.widgets.length && (
          <div className="empty-state">
            <strong>No widgets yet</strong>
            Add a live stat or list widget above.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard builder"
        description={`Role dashboards for ${currentOrg.name}. One primary landing per role — edit anytime.`}
        actions={
          <button className="btn primary" type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : 'New dashboard'}
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      {showCreate && (
        <form className="auth-form compact" onSubmit={(e) => void createDashboard(e)}>
          <h2>New role dashboard</h2>
          <div className="row-2">
            <label>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: f.slug && f.slug !== slugify(f.name) ? f.slug : slugify(name),
                  }));
                }}
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
              <option value="">None (not a role landing)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <button className="btn primary" type="submit">
            Create dashboard
          </button>
        </form>
      )}

      <div className="dashboard-builder-grid">
        {dashboards.map((d) => (
          <article key={d.id} className="dashboard-builder-card">
            <header>
              <h3>{d.name}</h3>
              {d.role ? (
                <span className="pill">{d.role.code}</span>
              ) : (
                <span className="pill muted-pill">No role</span>
              )}
            </header>
            <p className="muted tiny">{d.description || 'No description'}</p>
            <dl className="dashboard-builder-meta">
              <div>
                <dt>Role</dt>
                <dd>{d.role?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Widgets</dt>
                <dd>{d._count?.widgets ?? d.widgets.length}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatUpdated(d.updatedAt)}</dd>
              </div>
            </dl>
            <div className="action-row">
              <button className="btn primary" type="button" onClick={() => setEditingId(d.id)}>
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>

      {!dashboards.length && (
        <div className="empty-state">
          <strong>No dashboards yet</strong>
          Create a role dashboard to get started.
        </div>
      )}
    </div>
  );
}
