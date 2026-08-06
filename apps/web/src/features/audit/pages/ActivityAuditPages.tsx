import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, orgApi } from '../../../lib/api';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string } | null;
  organization?: { id: string; name: string; slug: string } | null;
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
  organization?: { id: string; name: string; slug: string } | null;
};

function useIsPlatformShell() {
  const location = useLocation();
  return location.pathname.startsWith('/app');
}

export function ActivityPage() {
  const isPlatform = useIsPlatformShell();
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [tab, setTab] = useState<'timeline' | 'mine' | 'logins'>('timeline');
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [mine, setMine] = useState<TimelineItem[]>([]);
  const [logins, setLogins] = useState<LoginItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlatform) {
      if (!user?.isPlatformAdmin) return;
      void (async () => {
        try {
          const [t, l] = await Promise.all([
            api<TimelineItem[]>('/platform/audit/timeline'),
            api<LoginItem[]>('/platform/audit/logins'),
          ]);
          setTimeline(t);
          setMine([]);
          setLogins(l);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed');
        }
      })();
      return;
    }

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
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [isPlatform, currentOrg?.id, user?.isPlatformAdmin]);

  if (isPlatform && !user?.isPlatformAdmin) {
    return (
      <section className="panel">
        <h1>Activity</h1>
        <div className="alert error">Only a platform admin can monitor Configure System activity.</div>
      </section>
    );
  }

  if (!isPlatform && !currentOrg) {
    return (
      <section className="panel">
        <h1>Activity</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  const rows = tab === 'timeline' ? timeline : tab === 'mine' ? mine : [];

  return (
    <section className="panel">
      <h1>Activity</h1>
      <p className="lede">
        {isPlatform
          ? 'Configure System monitor — activity across all projects and recent logins.'
          : 'Project timeline, your activity, and login history.'}
      </p>
      {error && <div className="alert error">{error}</div>}

      <div className="action-row">
        <button
          className={`btn ${tab === 'timeline' ? 'primary' : 'secondary'}`}
          type="button"
          onClick={() => setTab('timeline')}
        >
          Timeline
        </button>
        {!isPlatform && (
          <button
            className={`btn ${tab === 'mine' ? 'primary' : 'secondary'}`}
            type="button"
            onClick={() => setTab('mine')}
          >
            Mine
          </button>
        )}
        <button
          className={`btn ${tab === 'logins' ? 'primary' : 'secondary'}`}
          type="button"
          onClick={() => setTab('logins')}
        >
          Logins
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
                {item.organization ? ` · ${item.organization.name}` : ''}
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
                <strong>
                  {isPlatform && item.user?.email ? `${item.user.email} · ` : ''}
                  {item.success ? 'Success' : 'Failed'}
                </strong>
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
  const isPlatform = useIsPlatformShell();
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [orgLogins, setOrgLogins] = useState<LoginItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlatform) {
      if (!user?.isPlatformAdmin) return;
      void (async () => {
        try {
          const [a, l] = await Promise.all([
            api<AuditItem[]>('/platform/audit/logs'),
            api<LoginItem[]>('/platform/audit/logins'),
          ]);
          setLogs(a);
          setOrgLogins(l);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed');
        }
      })();
      return;
    }

    if (!currentOrg) return;
    void (async () => {
      try {
        const [a, l] = await Promise.all([
          orgApi<AuditItem[]>('/audit/logs'),
          orgApi<LoginItem[]>('/audit/logins/org'),
        ]);
        setLogs(a);
        setOrgLogins(l);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [isPlatform, currentOrg?.id, user?.isPlatformAdmin]);

  if (isPlatform && !user?.isPlatformAdmin) {
    return (
      <section className="panel">
        <h1>Audit</h1>
        <div className="alert error">Only a platform admin can monitor Configure System audit.</div>
      </section>
    );
  }

  if (!isPlatform && !currentOrg) {
    return (
      <section className="panel">
        <h1>Audit</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  if (
    !isPlatform &&
    !hasPermission('menu.audit') &&
    !hasPermission('screen.audit') &&
    !user?.isPlatformAdmin
  ) {
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
      <p className="lede">
        {isPlatform
          ? 'Configure System monitor — audit events across all projects and recent logins.'
          : 'Immutable admin audit trail and project login history.'}
      </p>
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
              {item.organization ? (
                <span className="muted"> · {item.organization.name}</span>
              ) : null}
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

      <h2>{isPlatform ? 'System login history' : 'Org login history'}</h2>
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
