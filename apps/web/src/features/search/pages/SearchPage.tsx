import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';

type SearchHit = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  path?: string;
};

type SavedSearch = {
  id: string;
  name: string;
  query: string;
  scope: string;
};

export function SearchPage() {
  const { currentOrg } = useOrg();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('ALL');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveName, setSaveName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSaved() {
    const list = await orgApi<SavedSearch[]>('/search/saved');
    setSaved(list);
  }

  useEffect(() => {
    if (!currentOrg) return;
    void loadSaved().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  async function runSearch(query = q, nextScope = scope) {
    const data = await orgApi<{ results: SearchHit[] }>(
      `/search?q=${encodeURIComponent(query)}&scope=${encodeURIComponent(nextScope)}`,
    );
    setResults(data.results);
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    try {
      await runSearch();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  }

  async function saveSearch(e: FormEvent) {
    e.preventDefault();
    await orgApi('/search/saved', {
      method: 'POST',
      body: JSON.stringify({ name: saveName, query: q, scope }),
    });
    setSaveName('');
    setMessage('Search saved');
    await loadSaved();
  }

  async function deleteSaved(id: string) {
    await orgApi(`/search/saved/${id}`, { method: 'DELETE' });
    await loadSaved();
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Search</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Universal Search</h1>
      <p className="lede">Global search across users, forms, grids, org entities, and dashboards.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void onSearch(e)}>
        <div className="row-2">
          <label>
            Query
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" required />
          </label>
          <label>
            Scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ALL">ALL</option>
              <option value="USER">USER</option>
              <option value="FORM">FORM</option>
              <option value="GRID">GRID</option>
              <option value="BRANCH">BRANCH</option>
              <option value="DEPARTMENT">DEPARTMENT</option>
              <option value="TEAM">TEAM</option>
              <option value="DASHBOARD">DASHBOARD</option>
            </select>
          </label>
        </div>
        <button className="btn primary" type="submit">
          Search
        </button>
      </form>

      <form className="auth-form compact" onSubmit={(e) => void saveSearch(e)}>
        <h2>Save this search</h2>
        <label>
          Name
          <input required value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        </label>
        <button className="btn secondary" type="submit" disabled={!q}>
          Save
        </button>
      </form>

      <div className="action-row">
        {saved.map((s) => (
          <button
            key={s.id}
            className="btn ghost"
            type="button"
            onClick={() => {
              setQ(s.query);
              setScope(s.scope);
              void runSearch(s.query, s.scope);
            }}
          >
            {s.name}
            <span
              className="tiny"
              onClick={(e) => {
                e.stopPropagation();
                void deleteSaved(s.id);
              }}
            >
              {' '}
              ×
            </span>
          </button>
        ))}
      </div>

      <h2>Results ({results.length})</h2>
      <ul className="timeline">
        {results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <div className="timeline-meta">
              <strong>
                [{r.type}] {r.title}
              </strong>
              {r.path && (
                <Link to={r.path} className="muted">
                  Open
                </Link>
              )}
            </div>
            {r.subtitle && <p className="muted">{r.subtitle}</p>}
          </li>
        ))}
        {!results.length && <li className="muted">No results.</li>}
      </ul>
    </section>
  );
}
