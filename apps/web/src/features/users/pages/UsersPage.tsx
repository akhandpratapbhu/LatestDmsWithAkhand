import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { OrgUserDto, PasswordPolicyDto } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { PageHeader } from '../../../components/PageHeader';
import { UserAvatar } from '../../../components/UserAvatar';

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function UsersPage() {
  const { currentOrg } = useOrg();
  const [users, setUsers] = useState<OrgUserDto[]>([]);
  const [policy, setPolicy] = useState<PasswordPolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.firstName, u.lastName, u.phone, u.role, u.status, u.accountStatus]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [users, query]);

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
        res.inviteToken ? `${res.message}. Dev token: ${res.inviteToken}` : res.message,
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
        <PageHeader title="Users" description="Create or select an organization first." />
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description={`Project members for ${currentOrg.name} — full profile details from the database.`}
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-head">
          <h2>
            Directory <span className="muted tiny">({filtered.length}/{users.length})</span>
          </h2>
          <input
            style={{ maxWidth: 260 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, role…"
          />
        </div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="data-table users-grid">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Home org</th>
                <th>Org role</th>
                <th>Membership</th>
                <th>Account</th>
                <th>Active</th>
                <th>Verified</th>
                <th>Joined</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.membershipId}>
                  <td>
                    <div className="users-grid-user">
                      <UserAvatar
                        firstName={u.firstName}
                        lastName={u.lastName}
                        avatarUrl={u.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <strong>
                          {u.firstName} {u.lastName}
                        </strong>
                        <div className="muted tiny mono">{u.userId.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td className="muted tiny mono">
                    {u.organizationId ? `${u.organizationId.slice(0, 8)}…` : '—'}
                  </td>
                  <td>
                    <span className="pill">{u.role}</span>
                  </td>
                  <td>
                    <span className={`pill ${u.status === 'ACTIVE' ? 'ok' : ''}`}>{u.status}</span>
                  </td>
                  <td>
                    <span className={`pill ${u.accountStatus === 'ACTIVE' ? 'ok' : ''}`}>
                      {u.accountStatus}
                    </span>
                  </td>
                  <td>{u.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    {u.emailVerified ? (
                      <span className="pill ok">Yes</span>
                    ) : (
                      <span className="pill">No</span>
                    )}
                  </td>
                  <td className="muted tiny">{fmtDate(u.joinedAt)}</td>
                  <td className="muted tiny">{fmtDate(u.createdAt)}</td>
                  <td className="muted tiny">{fmtDate(u.updatedAt)}</td>
                  <td>
                    <div className="action-row" style={{ marginTop: 0 }}>
                      {u.status !== 'ACTIVE' && (
                        <button
                          className="btn secondary sm"
                          type="button"
                          onClick={() => void activate(u.userId)}
                        >
                          Activate
                        </button>
                      )}
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => void setStatus(u.userId, 'SUSPENDED')}
                      >
                        Suspend
                      </button>
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => void setStatus(u.userId, 'DEACTIVATED')}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <strong>No users found</strong>
                      Create a user or clear the search filter.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="users-admin-grid">
        <section className="section-card">
          <div className="section-card-head">
            <h2>Create user</h2>
          </div>
          <div className="section-card-body">
            <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
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
          </div>
        </section>

        <section className="section-card">
          <div className="section-card-head">
            <h2>Invite user</h2>
          </div>
          <div className="section-card-body">
            <form className="auth-form compact" onSubmit={(e) => void onInvite(e)}>
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
          </div>
        </section>

        {policy && (
          <section className="section-card">
            <div className="section-card-head">
              <h2>Password policy</h2>
            </div>
            <div className="section-card-body">
              <form className="auth-form compact" onSubmit={(e) => void savePolicy(e)}>
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
                    onChange={(e) =>
                      setPolicy({ ...policy, requireUppercase: e.target.checked })
                    }
                  />
                  Require uppercase
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={policy.requireLowercase}
                    onChange={(e) =>
                      setPolicy({ ...policy, requireLowercase: e.target.checked })
                    }
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
                    onChange={(e) =>
                      setPolicy({ ...policy, requireSpecialChar: e.target.checked })
                    }
                  />
                  Require special character
                </label>
                <button className="btn secondary" type="submit">
                  Save policy
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
