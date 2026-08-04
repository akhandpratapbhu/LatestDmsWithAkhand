import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { OrganizationDto, ProjectStatus } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../org-context';

type EntityKind = 'branches' | 'departments' | 'designations' | 'teams' | 'cost-centers';

const TABS: { key: EntityKind; label: string }[] = [
  { key: 'branches', label: 'Branches' },
  { key: 'departments', label: 'Departments' },
  { key: 'designations', label: 'Designations' },
  { key: 'teams', label: 'Teams' },
  { key: 'cost-centers', label: 'Cost centers' },
];

const STATUSES: ProjectStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED', 'SUSPENDED'];

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { organizations, currentOrg, selectOrg, refreshOrgs, loading } = useOrg();
  const [tab, setTab] = useState<EntityKind>('branches');
  const [items, setItems] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    name: '',
    code: '',
    description: '',
    logoUrl: '',
    version: '1.0.0',
    theme: 'default',
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
    subdomain: '',
    status: 'ACTIVE' as ProjectStatus,
  });
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  const project =
    organizations.find((o) => o.id === projectId) ??
    (currentOrg?.id === projectId ? currentOrg : null);

  useEffect(() => {
    if (!project) return;
    if (currentOrg?.id !== project.id) {
      selectOrg(project.id);
    }
    if (hydratedId === project.id) return;
    setSettings({
      name: project.name,
      code: project.code ?? '',
      description: project.description ?? '',
      logoUrl: project.logoUrl ?? '',
      version: project.version ?? '1.0.0',
      theme: project.theme,
      currency: project.currency,
      language: project.language,
      timezone: project.timezone,
      subdomain: project.subdomain ?? '',
      status: project.status,
    });
    setHydratedId(project.id);
  }, [project, currentOrg?.id, selectOrg, hydratedId]);

  async function loadEntities() {
    if (!currentOrg || currentOrg.id !== projectId) {
      setItems([]);
      return;
    }
    const data = await orgApi<Array<{ id: string; name: string; code: string }>>(
      `/organizations/${tab}`,
    );
    setItems(data);
  }

  useEffect(() => {
    void loadEntities().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [currentOrg?.id, projectId, tab]);

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await orgApi<OrganizationDto>('/organizations/current', {
        method: 'PATCH',
        body: JSON.stringify({
          name: settings.name.trim(),
          code: settings.code.trim() || undefined,
          description: settings.description.trim() || null,
          logoUrl: settings.logoUrl.trim() || null,
          version: settings.version.trim() || '1.0.0',
          theme: settings.theme.trim() || 'default',
          currency: settings.currency.trim() || 'USD',
          language: settings.language.trim() || 'en',
          timezone: settings.timezone.trim() || 'UTC',
          subdomain: settings.subdomain.trim() || null,
          status: settings.status,
        }),
      });
      setHydratedId(null);
      await refreshOrgs();
      setMessage('Project settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function onCreateEntity(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await orgApi(`/organizations/${tab}`, {
        method: 'POST',
        body: JSON.stringify({ name, code }),
      });
      setName('');
      setCode('');
      setMessage(`${tab.replace('-', ' ')} created`);
      await loadEntities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onDelete(id: string) {
    await orgApi(`/organizations/${tab}/${id}`, { method: 'DELETE' });
    await loadEntities();
  }

  if (loading && !project) {
    return (
      <section className="panel">
        <p className="muted">Loading project…</p>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="panel">
        <h1>Project not found</h1>
        <p className="muted">
          <Link to="/app/projects">Back to Projects</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="muted tiny">
        <Link to="/app/projects">← Projects</Link>
      </p>
      <h1>{project.name}</h1>
      <p className="lede">Project settings and structure (branches, departments, teams).</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void onSaveSettings(e)}>
        <h2>Settings</h2>
        <label>
          Name
          <input
            value={settings.name}
            onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={settings.description}
            onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
            rows={3}
            maxLength={2000}
          />
        </label>
        <div className="row-2">
          <label>
            Code
            <input
              value={settings.code}
              onChange={(e) => setSettings((s) => ({ ...s, code: e.target.value }))}
            />
          </label>
          <label>
            Version
            <input
              value={settings.version}
              onChange={(e) => setSettings((s) => ({ ...s, version: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Logo URL
          <input
            value={settings.logoUrl}
            onChange={(e) => setSettings((s) => ({ ...s, logoUrl: e.target.value }))}
          />
        </label>
        <label>
          Database name
          <input value={project.databaseName ?? '—'} disabled readOnly />
        </label>
        <div className="row-2">
          <label>
            Subdomain
            <input
              value={settings.subdomain}
              onChange={(e) =>
                setSettings((s) => ({ ...s, subdomain: e.target.value.toLowerCase() }))
              }
            />
          </label>
          <label>
            Theme
            <input
              value={settings.theme}
              onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
            />
          </label>
        </div>
        <div className="row-2">
          <label>
            Currency
            <input
              value={settings.currency}
              onChange={(e) =>
                setSettings((s) => ({ ...s, currency: e.target.value.toUpperCase() }))
              }
            />
          </label>
          <label>
            Language
            <input
              value={settings.language}
              onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Timezone
          <input
            value={settings.timezone}
            onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
          />
        </label>
        <label>
          Status
          <select
            value={settings.status}
            onChange={(e) =>
              setSettings((s) => ({ ...s, status: e.target.value as ProjectStatus }))
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" type="submit">
          Save settings
        </button>
      </form>

      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn ${tab === t.key ? 'secondary' : 'ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="auth-form compact" onSubmit={(e) => void onCreateEntity(e)}>
        <h2>Add {tab.replace('-', ' ')}</h2>
        <div className="row-2">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
        </div>
        <button className="btn primary" type="submit">
          Add
        </button>
      </form>

      <ul className="session-list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p className="muted">{item.code}</p>
            </div>
            <button className="btn ghost" type="button" onClick={() => void onDelete(item.id)}>
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 && <p className="muted">No records yet.</p>}
      </ul>
    </section>
  );
}
