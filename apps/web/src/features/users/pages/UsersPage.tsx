import { FormEvent, useEffect, useState } from 'react';
import type { OrgUserDto, PasswordPolicyDto } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';

export function UsersPage() {
  const { currentOrg } = useOrg();
  const [users, setUsers] = useState<OrgUserDto[]>([]);
  const [policy, setPolicy] = useState<PasswordPolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [inviteEmail, setInviteEmail] = useState('');

  async function load() {
    if (!currentOrg) return;
    const [list, pol] = await Promise.all([
      orgApi<OrgUserDto[]>('/users'),
      orgApi<PasswordPolicyDto>('/organizations/password-policy'),
    ]);
    setUsers(list);
    setPolicy(pol);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await orgApi('/users', { method: 'POST', body: JSON.stringify(form) });
      setMessage('User created');
      setForm({ email: '', password: '', firstName: '', lastName: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await orgApi<{ message: string; inviteToken?: string }>('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setMessage(
        res.inviteToken
          ? `${res.message}. Dev token: ${res.inviteToken}`
          : res.message,
      );
      setInviteEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function activate(userId: string) {
    await orgApi(`/users/${userId}/activate`, { method: 'POST' });
    await load();
  }

  async function setStatus(userId: string, status: string) {
    await orgApi(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function savePolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!policy) return;
    const updated = await orgApi<PasswordPolicyDto>('/organizations/password-policy', {
      method: 'PATCH',
      body: JSON.stringify({
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumber: policy.requireNumber,
        requireSpecialChar: policy.requireSpecialChar,
      }),
    });
    setPolicy(updated);
    setMessage('Password policy updated');
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Users</h1>
        <p className="lede">Create or select an organization first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Users</h1>
      <p className="lede">CRUD, invite, activate, and status for {currentOrg.name}.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
        <h2>Create user</h2>
        <div className="row-2">
          <label>
            First name
            <input
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </label>
          <label>
            Last name
            <input
              required
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </label>
        <button className="btn primary" type="submit">
          Create
        </button>
      </form>

      <form className="auth-form compact" onSubmit={(e) => void onInvite(e)}>
        <h2>Invite user</h2>
        <label>
          Email
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </label>
        <button className="btn secondary" type="submit">
          Send invite
        </button>
      </form>

      {policy && (
        <form className="auth-form compact" onSubmit={(e) => void savePolicy(e)}>
          <h2>Password policy</h2>
          <label>
            Min length
            <input
              type="number"
              min={6}
              value={policy.minLength}
              onChange={(e) =>
                setPolicy({ ...policy, minLength: Number(e.target.value) })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={policy.requireUppercase}
              onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
            />
            Require uppercase
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={policy.requireLowercase}
              onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })}
            />
            Require lowercase
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={policy.requireNumber}
              onChange={(e) => setPolicy({ ...policy, requireNumber: e.target.checked })}
            />
            Require number
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={policy.requireSpecialChar}
              onChange={(e) => setPolicy({ ...policy, requireSpecialChar: e.target.checked })}
            />
            Require special character
          </label>
          <button className="btn secondary" type="submit">
            Save policy
          </button>
        </form>
      )}

      <ul className="session-list">
        {users.map((u) => (
          <li key={u.membershipId}>
            <div>
              <strong>
                {u.firstName} {u.lastName}
              </strong>
              <span className="badge">{u.status}</span>
              <p className="muted">
                {u.email} · {u.role}
              </p>
            </div>
            <div className="action-row">
              {u.status !== 'ACTIVE' && (
                <button className="btn secondary" type="button" onClick={() => void activate(u.userId)}>
                  Activate
                </button>
              )}
              <button
                className="btn ghost"
                type="button"
                onClick={() => void setStatus(u.userId, 'SUSPENDED')}
              >
                Suspend
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => void setStatus(u.userId, 'DEACTIVATED')}
              >
                Deactivate
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
