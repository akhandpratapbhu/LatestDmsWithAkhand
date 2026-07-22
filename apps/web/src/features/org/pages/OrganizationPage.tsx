import { FormEvent, useEffect, useState } from 'react';
import type { OrganizationDto } from '@dms/shared';
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

export function OrganizationPage() {
  const { organizations, currentOrg, createOrg, selectOrg, loading } = useOrg();
  const [tab, setTab] = useState<EntityKind>('branches');
  const [items, setItems] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) {
      setItems([]);
      return;
    }
    const data = await orgApi<Array<{ id: string; name: string; code: string }>>(
      `/organizations/${tab}`,
    );
    setItems(data);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [currentOrg?.id, tab]);

  async function onCreateOrg(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createOrg(orgName);
      setOrgName('');
      setMessage('Organization created');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
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
      setMessage(`${tab} created`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onDelete(id: string) {
    await orgApi(`/organizations/${tab}/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="panel">
      <h1>Organization</h1>
      <p className="lede">
        Multi-tenant setup — each company can have multiple branches, plus departments, teams, and
        cost centers.
      </p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="action-row">
        <label className="inline-field">
          Active organization
          <select
            value={currentOrg?.id ?? ''}
            onChange={(e) => selectOrg(e.target.value)}
            disabled={loading || organizations.length === 0}
          >
            {organizations.map((o: OrganizationDto) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form className="auth-form compact" onSubmit={(e) => void onCreateOrg(e)}>
        <h2>Create organization</h2>
        <label>
          Company name
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
        </label>
        <button className="btn primary" type="submit">
          Create
        </button>
      </form>

      {currentOrg && (
        <>
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
        </>
      )}
    </section>
  );
}
