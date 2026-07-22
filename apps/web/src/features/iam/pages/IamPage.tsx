import { FormEvent, useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../iam-context';

type RoleRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  _count?: { memberRoles: number; roleMenus: number };
};

type PermRow = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export function IamPage() {
  const { currentOrg } = useOrg();
  const { refreshSidebar, hasPermission } = useIam();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '' });
  const [permForm, setPermForm] = useState({
    code: '',
    name: '',
    type: 'MENU',
  });

  async function load() {
    if (!currentOrg) return;
    const [r, p] = await Promise.all([
      orgApi<RoleRow[]>('/iam/roles'),
      orgApi<PermRow[]>('/iam/permissions'),
    ]);
    setRoles(r);
    setPermissions(p);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  async function createRole(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await orgApi('/iam/roles', { method: 'POST', body: JSON.stringify(roleForm) });
      setRoleForm({ name: '', code: '', description: '' });
      setMessage('Role created');
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function createPermission(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await orgApi('/iam/permissions', { method: 'POST', body: JSON.stringify(permForm) });
      setPermForm({ code: '', name: '', type: 'MENU' });
      setMessage('Permission created');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>IAM</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!hasPermission('screen.iam') && !hasPermission('menu.iam')) {
    return (
      <section className="panel">
        <h1>IAM</h1>
        <div className="alert error">You are not authorized to manage IAM.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Identity & Access</h1>
      <p className="lede">
        Roles, permissions, menus, and screen/API/data access for {currentOrg.name}.
      </p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void createRole(e)}>
        <h2>Create role</h2>
        <div className="row-2">
          <label>
            Name
            <input
              required
              value={roleForm.name}
              onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Code
            <input
              required
              value={roleForm.code}
              onChange={(e) => setRoleForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Description
          <input
            value={roleForm.description}
            onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <button className="btn primary" type="submit">
          Add role
        </button>
      </form>

      <ul className="session-list">
        {roles.map((r) => (
          <li key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <span className="badge">{r.code}</span>
              <p className="muted">
                {r.description || 'No description'} · members {r._count?.memberRoles ?? 0} · menus{' '}
                {r._count?.roleMenus ?? 0}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <form className="auth-form compact" onSubmit={(e) => void createPermission(e)}>
        <h2>Create permission</h2>
        <div className="row-2">
          <label>
            Code
            <input
              required
              value={permForm.code}
              onChange={(e) => setPermForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <label>
            Type
            <select
              value={permForm.type}
              onChange={(e) => setPermForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="MENU">MENU</option>
              <option value="SCREEN">SCREEN</option>
              <option value="API">API</option>
              <option value="DATA">DATA</option>
            </select>
          </label>
        </div>
        <label>
          Name
          <input
            required
            value={permForm.name}
            onChange={(e) => setPermForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <button className="btn secondary" type="submit">
          Add permission
        </button>
      </form>

      <ul className="session-list">
        {permissions.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <span className="badge">{p.type}</span>
              <p className="muted">{p.code}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
