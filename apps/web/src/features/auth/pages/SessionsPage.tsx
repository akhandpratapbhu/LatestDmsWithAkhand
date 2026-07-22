import { useCallback, useEffect, useState } from 'react';
import type { SessionInfo } from '@dms/shared';
import { fetchSessions, revokeSession } from '../auth-context';

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await fetchSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRevoke(id: string) {
    try {
      await revokeSession(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  }

  return (
    <section className="panel">
      <h1>Active sessions</h1>
      <p className="lede">
        Multi-device login management. Revoke any session except the current one.
      </p>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">Loading sessions…</p>}

      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id} className={s.current ? 'current' : undefined}>
            <div>
              <strong>{s.deviceName || 'Unknown device'}</strong>
              {s.current && <span className="badge">Current</span>}
              <p className="muted">
                {s.ipAddress || '—'} · last active {new Date(s.lastActiveAt).toLocaleString()}
              </p>
              <p className="muted tiny">{s.userAgent}</p>
            </div>
            {!s.current && (
              <button className="btn ghost" type="button" onClick={() => void onRevoke(s.id)}>
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
