import { useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
};

type LoginItem = {
  id: string;
  success: boolean;
  ipAddress: string | null;
  deviceName: string | null;
  failureReason: string | null;
  createdAt: string;
  user?: { email: string; firstName: string; lastName: string };
};

type AuditItem = {
  id: string;
  action: string;
  resource: string;
  summary: string | null;
  createdAt: string;
  user?: { email: string; firstName: string; lastName: string } | null;
};

export function ActivityPage() {
  const { currentOrg } = useOrg();
  const [tab, setTab] = useState<'timeline' | 'mine' | 'logins'>('timeline');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [mine, setMine] = useState<TimelineItem[]>([]);
  const [logins, setLogins] = useState<LoginItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    void (async () => {
      try {
        const [t, m, l] = await Promise.all([
          orgApi<TimelineItem[]>('/audit/timeline'),
          orgApi<TimelineItem[]>('/audit/me'),
          orgApi<LoginItem[]>('/audit/logins'),
        ]);
        setTimeline(t);
        setMine(m);
        setLogins(l);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [currentOrg?.id]);

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Activity</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  const rows = tab === 'timeline' ? timeline : tab === 'mine' ? mine : [];

  return (
    <section className="panel">
      <h1>Activity</h1>
      <p className="lede">Project timeline, your activity, and login history.</p>
      {error && <div className="alert error">{error}</div>}

      <div className="action-row">
        <button className={`btn ${tab === 'timeline' ? 'primary' : 'secondary'}`} type="button" onClick={() => setTab('timeline')}>
          Timeline
        </button>
        <button className={`btn ${tab === 'mine' ? 'primary' : 'secondary'}`} type="button" onClick={() => setTab('mine')}>
          My activity
        </button>
        <button className={`btn ${tab === 'logins' ? 'primary' : 'secondary'}`} type="button" onClick={() => setTab('logins')}>
          Login history
        </button>
      </div>

      {tab !== 'logins' ? (
        <ul className="timeline">
          {rows.map((item) => (
            <li key={item.id}>
              <div className="timeline-meta">
                <strong>{item.title}</strong>
                <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="muted">
                {item.type}
                {item.user ? ` · ${item.user.firstName} ${item.user.lastName}` : ''}
              </p>
              {item.summary && <p>{item.summary}</p>}
            </li>
          ))}
          {!rows.length && <li className="muted">No activity yet.</li>}
        </ul>
      ) : (
        <ul className="timeline">
          {logins.map((item) => (
            <li key={item.id}>
              <div className="timeline-meta">
                <strong>{item.success ? 'Success' : 'Failed'}</strong>
                <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="muted">
                {item.deviceName || 'Device'} · {item.ipAddress || 'ip n/a'}
                {item.failureReason ? ` · ${item.failureReason}` : ''}
              </p>
            </li>
          ))}
          {!logins.length && <li className="muted">No login history.</li>}
        </ul>
      )}
    </section>
  );
}

export function AuditPage() {
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [orgLogins, setOrgLogins] = useState<LoginItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    void (async () => {
      try {
        const [a, l] = await Promise.all([
          orgApi<AuditItem[]>('/audit/logs'),
          orgApi<LoginItem[]>('/audit/logins/org'),
        ]);
        setLogs(a);
        setOrgLogins(l);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [currentOrg?.id]);

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Audit</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!hasPermission('menu.audit') && !hasPermission('screen.audit')) {
    return (
      <section className="panel">
        <h1>Audit</h1>
        <div className="alert error">Not authorized.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Audit Log</h1>
      <p className="lede">Immutable admin audit trail and organization login history.</p>
      {error && <div className="alert error">{error}</div>}

      <h2>Audit events</h2>
      <ul className="timeline">
        {logs.map((item) => (
          <li key={item.id}>
            <div className="timeline-meta">
              <strong>
                {item.action} · {item.resource}
              </strong>
              <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p>
              {item.summary || '—'}
              {item.user ? (
                <span className="muted">
                  {' '}
                  · {item.user.firstName} {item.user.lastName}
                </span>
              ) : null}
            </p>
          </li>
        ))}
        {!logs.length && <li className="muted">No audit events.</li>}
      </ul>

      <h2>Org login history</h2>
      <ul className="timeline">
        {orgLogins.map((item) => (
          <li key={item.id}>
            <div className="timeline-meta">
              <strong>
                {item.user?.email ?? 'user'} · {item.success ? 'ok' : 'fail'}
              </strong>
              <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p className="muted">
              {item.ipAddress || 'ip n/a'}
              {item.failureReason ? ` · ${item.failureReason}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
