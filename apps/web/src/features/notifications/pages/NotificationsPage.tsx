import { FormEvent, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getAccessToken, orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { useAuth } from '../../auth/auth-context';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  deliveries: Array<{ channel: string; status: string }>;
};

type Prefs = {
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  mutedTypes: string[];
};

export function NotificationsPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { hasPermission } = useIam();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sendForm, setSendForm] = useState({
    userId: '',
    title: '',
    body: '',
    type: 'INFO',
  });
  const [members, setMembers] = useState<Array<{ userId: string; email: string; name: string }>>(
    [],
  );

  async function load() {
    const [list, preferences] = await Promise.all([
      orgApi<NotificationItem[]>('/notifications'),
      api<Prefs>('/notifications/preferences'),
    ]);
    setItems(list);
    setPrefs({
      ...preferences,
      mutedTypes: Array.isArray(preferences.mutedTypes)
        ? (preferences.mutedTypes as string[])
        : [],
    });
  }

  useEffect(() => {
    if (!currentOrg) return;
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
    void orgApi<Array<{ userId: string; email: string; firstName: string; lastName: string }>>(
      '/users',
    )
      .then((rows) =>
        setMembers(
          rows.map((r) => ({
            userId: r.userId,
            email: r.email,
            name: `${r.firstName} ${r.lastName}`,
          })),
        ),
      )
      .catch(() => undefined);
  }, [currentOrg?.id]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const socket: Socket = io(`${window.location.origin}/notifications`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('notification', (payload: NotificationItem) => {
      setItems((prev) => [payload, ...prev.filter((n) => n.id !== payload.id)]);
      setMessage(`Live: ${payload.title}`);
    });
    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  async function savePrefs(e: FormEvent) {
    e.preventDefault();
    if (!prefs) return;
    const updated = await api<Prefs>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    setPrefs({
      ...updated,
      mutedTypes: Array.isArray(updated.mutedTypes) ? (updated.mutedTypes as string[]) : [],
    });
    setMessage('Preferences saved');
  }

  async function registerDevice() {
    const token = `web-${user?.id ?? 'anon'}-${Date.now()}`;
    await api('/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'web', label: 'Browser' }),
    });
    setMessage('Push device registered');
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' });
    await load();
  }

  async function markOne(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    await orgApi('/notifications/send', {
      method: 'POST',
      body: JSON.stringify({
        ...sendForm,
        channels: ['IN_APP', 'EMAIL', 'PUSH'],
      }),
    });
    setMessage('Notification sent');
    setSendForm((f) => ({ ...f, title: '', body: '' }));
    await load();
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Notifications</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Notifications</h1>
      <p className="lede">
        In-app, email, and push delivery with live updates.{' '}
        <span className={live ? 'pill ok' : 'pill'}>{live ? 'Realtime connected' : 'Offline'}</span>
      </p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="action-row">
        <button className="btn secondary" type="button" onClick={() => void markAll()}>
          Mark all read
        </button>
        <button className="btn secondary" type="button" onClick={() => void registerDevice()}>
          Register push device
        </button>
      </div>

      {prefs && (
        <form className="auth-form compact" onSubmit={(e) => void savePrefs(e)}>
          <h2>Preferences</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs((p) => (p ? { ...p, inAppEnabled: e.target.checked } : p))}
            />
            In-app
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.emailEnabled}
              onChange={(e) => setPrefs((p) => (p ? { ...p, emailEnabled: e.target.checked } : p))}
            />
            Email
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.pushEnabled}
              onChange={(e) => setPrefs((p) => (p ? { ...p, pushEnabled: e.target.checked } : p))}
            />
            Push
          </label>
          <button className="btn secondary" type="submit">
            Save preferences
          </button>
        </form>
      )}

      {(hasPermission('api.notifications.write') || hasPermission('menu.audit')) && (
        <form className="auth-form compact" onSubmit={(e) => void send(e)}>
          <h2>Send notification</h2>
          <label>
            Recipient
            <select
              required
              value={sendForm.userId}
              onChange={(e) => setSendForm((f) => ({ ...f, userId: e.target.value }))}
            >
              <option value="">Select user</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              value={sendForm.title}
              onChange={(e) => setSendForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            Body
            <textarea
              required
              value={sendForm.body}
              onChange={(e) => setSendForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>
          <button className="btn primary" type="submit">
            Send
          </button>
        </form>
      )}

      <h2>Inbox</h2>
      <ul className="timeline">
        {items.map((n) => (
          <li key={n.id} className={n.readAt ? '' : 'unread'}>
            <div className="timeline-meta">
              <strong>{n.title}</strong>
              <span className="muted">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p>{n.body}</p>
            <div className="action-row">
              <span className="muted tiny">
                {n.deliveries.map((d) => `${d.channel}:${d.status}`).join(' · ')}
              </span>
              {!n.readAt && (
                <button className="btn ghost" type="button" onClick={() => void markOne(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
        {!items.length && <li className="muted">No notifications yet.</li>}
      </ul>
    </section>
  );
}
