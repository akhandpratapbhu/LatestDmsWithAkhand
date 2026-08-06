import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { OrgUserDto } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { useOrg } from '../../org/org-context';
import { useIam } from '../iam-context';

type CrudAction = 'view' | 'create' | 'update' | 'delete';

type RoleRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  rolePermissions?: Array<{ permissionId: string; permission: { id: string; code: string } }>;
  roleMenus?: Array<{ menuId: string }>;
  memberRoles?: Array<{ member: { userId: string } }>;
  _count?: { memberRoles: number; roleMenus: number };
};

type PermRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  resource?: string | null;
  action?: string | null;
};

type MenuRow = {
  id: string;
  label: string;
  path: string | null;
  permission: { id: string; code: string } | null;
  children?: MenuRow[];
};

type MenuGroupRow = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  menus: MenuRow[];
};

type MatrixRow = {
  menuId: string;
  label: string;
  path: string | null;
  groupName: string;
  resource: string;
};

type RowState = Record<CrudAction, boolean>;

const CRUD_ACTIONS: CrudAction[] = ['view', 'create', 'update', 'delete'];

function resourceFromMenuPerm(code: string | undefined | null): string | null {
  if (!code?.startsWith('menu.')) return null;
  return code.slice('menu.'.length);
}

function emptyRow(): RowState {
  return { view: false, create: false, update: false, delete: false };
}

function allChecked(row: RowState) {
  return CRUD_ACTIONS.every((a) => row[a]);
}

/** Permission codes tied to a matrix cell (resource + action). */
function codesForAction(resource: string, action: CrudAction, allCodes: Set<string>): string[] {
  const codes: string[] = [`${resource}.${action}`];
  if (action === 'view') {
    const menu = `menu.${resource}`;
    const screen = `screen.${resource}`;
    if (allCodes.has(menu)) codes.push(menu);
    if (allCodes.has(screen)) codes.push(screen);
  } else {
    const apiWrite = `api.${resource}.write`;
    if (allCodes.has(apiWrite)) codes.push(apiWrite);
  }
  return codes.filter((c) => allCodes.has(c) || c === `${resource}.${action}`);
}

function isActionGranted(
  resource: string,
  action: CrudAction,
  granted: Set<string>,
  menuIds: Set<string>,
  menuId: string,
  allCodes: Set<string>,
): boolean {
  if (granted.has(`${resource}.${action}`)) return true;
  if (action === 'view') {
    if (menuIds.has(menuId)) return true;
    if (granted.has(`menu.${resource}`) || granted.has(`screen.${resource}`)) return true;
    return false;
  }
  // Legacy: bare api.*.write without granular CRUD → treat as full write
  const apiWrite = `api.${resource}.write`;
  if (
    granted.has(apiWrite) &&
    !granted.has(`${resource}.create`) &&
    !granted.has(`${resource}.update`) &&
    !granted.has(`${resource}.delete`)
  ) {
    return true;
  }
  void allCodes;
  return false;
}

export function IamPage() {
  const { currentOrg } = useOrg();
  const { refreshSidebar, hasPermission } = useIam();
  const [tab, setTab] = useState<'roles' | 'assign' | 'permissions'>('roles');
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [menuGroups, setMenuGroups] = useState<MenuGroupRow[]>([]);
  const [users, setUsers] = useState<OrgUserDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', code: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [matrix, setMatrix] = useState<Record<string, RowState>>({});
  const [readOnly, setReadOnly] = useState(false);
  const [userRoleCodes, setUserRoleCodes] = useState<string[]>([]);

  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleIds, setAssignRoleIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [rolesMenuOpen, setRolesMenuOpen] = useState(false);
  const rolesMenuRef = useRef<HTMLDivElement>(null);

  const permByCode = useMemo(() => {
    const map = new Map<string, PermRow>();
    for (const p of permissions) map.set(p.code, p);
    return map;
  }, [permissions]);

  const allPermCodes = useMemo(() => new Set(permissions.map((p) => p.code)), [permissions]);

  const matrixRows = useMemo((): MatrixRow[] => {
    const rows: MatrixRow[] = [];
    for (const g of menuGroups) {
      for (const m of g.menus) {
        const resource = resourceFromMenuPerm(m.permission?.code);
        if (!resource) continue;
        rows.push({
          menuId: m.id,
          label: m.label,
          path: m.path,
          groupName: g.name,
          resource,
        });
        for (const child of m.children ?? []) {
          const childResource = resourceFromMenuPerm(child.permission?.code);
          if (!childResource) continue;
          rows.push({
            menuId: child.id,
            label: `${m.label} › ${child.label}`,
            path: child.path,
            groupName: g.name,
            resource: childResource,
          });
        }
      }
    }
    return rows;
  }, [menuGroups]);

  const filteredUsers = useMemo(() => {
    if (!selectedRoleId) return users;
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role?.memberRoles?.length) return users;
    const ids = new Set(role.memberRoles.map((mr) => mr.member.userId));
    return users.filter((u) => ids.has(u.userId));
  }, [users, roles, selectedRoleId]);

  async function load() {
    if (!currentOrg) return;
    const [r, p, groups, u] = await Promise.all([
      orgApi<RoleRow[]>('/iam/roles'),
      orgApi<PermRow[]>('/iam/permissions'),
      orgApi<MenuGroupRow[]>('/iam/menu-groups?forPermissions=true'),
      orgApi<OrgUserDto[]>('/users'),
    ]);
    setRoles(r);
    setPermissions(p);
    setMenuGroups(groups);
    setUsers(u);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!rolesMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (rolesMenuRef.current && !rolesMenuRef.current.contains(e.target as Node)) {
        setRolesMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [rolesMenuOpen]);

  useEffect(() => {
    if (tab !== 'assign' || !assignUserId) {
      if (!assignUserId) setAssignRoleIds([]);
      return;
    }
    void (async () => {
      setAssignLoading(true);
      setError(null);
      try {
        const res = await orgApi<{
          roles: Array<{ id: string; name: string; code: string }>;
        }>(`/iam/members/${assignUserId}/permissions`);
        setAssignRoleIds(res.roles.map((r) => r.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load user roles');
        setAssignRoleIds([]);
      } finally {
        setAssignLoading(false);
      }
    })();
  }, [tab, assignUserId]);

  const assignRoleSummary = useMemo(() => {
    if (!assignRoleIds.length) return 'Select roles…';
    const names = roles.filter((r) => assignRoleIds.includes(r.id)).map((r) => r.name);
    if (names.length <= 2) return names.join(', ');
    return `${names.length} roles selected`;
  }, [assignRoleIds, roles]);

  function toggleAssignRole(roleId: string, checked: boolean) {
    setAssignRoleIds((prev) => {
      if (checked) return prev.includes(roleId) ? prev : [...prev, roleId];
      return prev.filter((id) => id !== roleId);
    });
  }

  async function saveAssignRoles() {
    if (!assignUserId) return;
    setError(null);
    setMessage(null);
    setAssignSaving(true);
    try {
      await orgApi(`/iam/members/${assignUserId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleIds: assignRoleIds }),
      });
      setMessage('Roles assigned');
      setRolesMenuOpen(false);
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign roles');
    } finally {
      setAssignSaving(false);
    }
  }

  function applyGrantedToMatrix(granted: Set<string>, menuIds: Set<string>) {
    const next: Record<string, RowState> = {};
    for (const row of matrixRows) {
      const state = emptyRow();
      for (const action of CRUD_ACTIONS) {
        state[action] = isActionGranted(
          row.resource,
          action,
          granted,
          menuIds,
          row.menuId,
          allPermCodes,
        );
      }
      next[row.menuId] = state;
    }
    setMatrix(next);
  }

  async function loadRoleMatrix(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const granted = new Set(
      (role.rolePermissions ?? []).map((rp) => rp.permission.code),
    );
    const menuIds = new Set((role.roleMenus ?? []).map((rm) => rm.menuId));
    setReadOnly(false);
    setUserRoleCodes([]);
    applyGrantedToMatrix(granted, menuIds);
  }

  async function loadUserEffective(userId: string) {
    const res = await orgApi<{
      permissionCodes: string[];
      roles: Array<{ id: string; name: string; code: string }>;
    }>(`/iam/members/${userId}/permissions`);
    setReadOnly(true);
    setUserRoleCodes(res.roles.map((r) => r.code));
    applyGrantedToMatrix(new Set(res.permissionCodes), new Set());
  }

  useEffect(() => {
    if (tab !== 'permissions' || !matrixRows.length) return;
    void (async () => {
      setError(null);
      try {
        if (selectedRoleId) {
          await loadRoleMatrix(selectedRoleId);
        } else if (selectedUserId) {
          await loadUserEffective(selectedUserId);
        } else {
          setMatrix({});
          setReadOnly(false);
          setUserRoleCodes([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load permissions');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters / catalog change
  }, [tab, selectedRoleId, selectedUserId, roles, matrixRows, allPermCodes]);

  function setRowAction(menuId: string, action: CrudAction, checked: boolean) {
    if (readOnly) return;
    setMatrix((prev) => {
      const row = { ...(prev[menuId] ?? emptyRow()), [action]: checked };
      return { ...prev, [menuId]: row };
    });
  }

  function setMaster(menuId: string, checked: boolean) {
    if (readOnly) return;
    setMatrix((prev) => ({
      ...prev,
      [menuId]: {
        view: checked,
        create: checked,
        update: checked,
        delete: checked,
      },
    }));
  }

  async function createRole(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await orgApi('/iam/roles', { method: 'POST', body: JSON.stringify(roleForm) });
      setRoleForm({ name: '', code: '', description: '' });
      setShowRoleModal(false);
      setMessage('Role created');
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function saveMatrix() {
    if (!selectedRoleId || readOnly) return;
    setError(null);
    setSaving(true);
    try {
      const permissionIds = new Set<string>();
      const menuIds: string[] = [];

      // Keep permissions not represented in the matrix (data.*, extras)
      const matrixCodes = new Set<string>();
      for (const row of matrixRows) {
        for (const action of CRUD_ACTIONS) {
          for (const c of codesForAction(row.resource, action, allPermCodes)) {
            matrixCodes.add(c);
          }
        }
        matrixCodes.add(`menu.${row.resource}`);
        matrixCodes.add(`screen.${row.resource}`);
        matrixCodes.add(`api.${row.resource}.write`);
        matrixCodes.add(`${row.resource}.view`);
        matrixCodes.add(`${row.resource}.create`);
        matrixCodes.add(`${row.resource}.update`);
        matrixCodes.add(`${row.resource}.delete`);
      }

      const role = roles.find((r) => r.id === selectedRoleId);
      for (const rp of role?.rolePermissions ?? []) {
        if (!matrixCodes.has(rp.permission.code)) {
          permissionIds.add(rp.permissionId);
        }
      }

      for (const row of matrixRows) {
        const state = matrix[row.menuId] ?? emptyRow();
        if (state.view) menuIds.push(row.menuId);

        for (const action of CRUD_ACTIONS) {
          if (!state[action]) continue;
          for (const code of codesForAction(row.resource, action, allPermCodes)) {
            const perm = permByCode.get(code);
            if (perm) permissionIds.add(perm.id);
          }
          // Ensure CRUD code exists in map (created by ensureCrudPermissions)
          const crud = permByCode.get(`${row.resource}.${action}`);
          if (crud) permissionIds.add(crud.id);
        }

        // If any write action, keep legacy api.*.write when present
        if (state.create || state.update || state.delete) {
          const apiWrite = permByCode.get(`api.${row.resource}.write`);
          if (apiWrite) permissionIds.add(apiWrite.id);
        }
      }

      await orgApi(`/iam/roles/${selectedRoleId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          permissionIds: [...permissionIds],
          menuIds,
        }),
      });
      setMessage('Permissions saved');
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <PageHeader title="Identity & Access" description="Select an organization first." />
      </section>
    );
  }

  if (!hasPermission('screen.iam') && !hasPermission('menu.iam')) {
    return (
      <section className="panel">
        <PageHeader title="Identity & Access" />
        <div className="alert error">You are not authorized to manage IAM.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <PageHeader
        title="Identity & Access"
        description={`Roles, role assignment, and permission matrix for ${currentOrg.name}.`}
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="tab-row">
        <button
          type="button"
          className={`btn ${tab === 'roles' ? 'secondary' : 'ghost'}`}
          onClick={() => {
            setTab('roles');
            setMessage(null);
          }}
        >
          Roles
        </button>
        <button
          type="button"
          className={`btn ${tab === 'assign' ? 'secondary' : 'ghost'}`}
          onClick={() => {
            setTab('assign');
            setMessage(null);
            setRolesMenuOpen(false);
          }}
        >
          Role assign
        </button>
        <button
          type="button"
          className={`btn ${tab === 'permissions' ? 'secondary' : 'ghost'}`}
          onClick={() => {
            setTab('permissions');
            setMessage(null);
          }}
        >
          Permissions
        </button>
      </div>

      {tab === 'roles' && (
        <>
          <div className="grid-toolbar">
            <button type="button" className="btn primary" onClick={() => setShowRoleModal(true)}>
              Add new role
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th>Menus</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      {r.isSystem ? <span className="badge">system</span> : null}
                    </td>
                    <td>
                      <code className="mono">{r.code}</code>
                    </td>
                    <td className="muted">{r.description || '—'}</td>
                    <td>{r._count?.memberRoles ?? 0}</td>
                    <td>{r._count?.roleMenus ?? 0}</td>
                  </tr>
                ))}
                {!roles.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No roles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'assign' && (
        <form
          className="auth-form compact iam-perm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAssignRoles();
          }}
        >
          <div className="row-2">
            <label>
              User
              <select
                value={assignUserId}
                onChange={(e) => {
                  setAssignUserId(e.target.value);
                  setMessage(null);
                  setRolesMenuOpen(false);
                }}
              >
                <option value="">Select a user…</option>
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Roles
              <div className="iam-multi-select" ref={rolesMenuRef}>
                <button
                  type="button"
                  className="iam-multi-select-trigger"
                  disabled={!assignUserId || assignLoading}
                  aria-expanded={rolesMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => setRolesMenuOpen((open) => !open)}
                >
                  {assignLoading ? 'Loading roles…' : assignRoleSummary}
                </button>
                {rolesMenuOpen && assignUserId && !assignLoading ? (
                  <div className="iam-multi-select-menu" role="listbox" aria-multiselectable="true">
                    {roles.map((r) => {
                      const checked = assignRoleIds.includes(r.id);
                      return (
                        <label key={r.id} className="checkbox-row iam-multi-select-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleAssignRole(r.id, e.target.checked)}
                          />
                          <span>
                            {r.name}{' '}
                            <span className="muted">
                              (<code className="mono">{r.code}</code>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {!roles.length && <p className="muted">No roles available.</p>}
                  </div>
                ) : null}
              </div>
            </label>
          </div>
          <p className="muted">
            {assignUserId
              ? 'Check one or more roles for this user, then save to replace their current role set.'
              : 'Select a user to view and edit their assigned roles.'}
          </p>
          <div className="grid-toolbar">
            <button
              type="submit"
              className="btn primary"
              disabled={!assignUserId || assignLoading || assignSaving}
            >
              {assignSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {tab === 'permissions' && (
        <>
          <form
            className="auth-form compact iam-perm-filters"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="row-2">
              <label>
                Roles
                <select
                  value={selectedRoleId}
                  onChange={(e) => {
                    setSelectedRoleId(e.target.value);
                    setSelectedUserId('');
                    setMessage(null);
                  }}
                >
                  <option value="">Select a role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Users
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setMessage(null);
                  }}
                >
                  <option value="">All users (optional)</option>
                  {(selectedRoleId ? filteredUsers : users).map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              {selectedRoleId
                ? 'Editing the selected role’s permission matrix. User filter narrows members who have this role.'
                : selectedUserId
                  ? `Read-only effective permissions${userRoleCodes.length ? ` via roles: ${userRoleCodes.join(', ')}` : ''}. Select a role to edit.`
                  : 'Select a role to load and edit permissions. Selecting only a user shows effective permissions (read-only).'}
            </p>
          </form>

          {selectedRoleId || selectedUserId ? (
            <>
              <div className="table-wrap">
                <table className="data-table iam-perm-matrix">
                  <thead>
                    <tr>
                      <th>Sidebar / module</th>
                      <th className="iam-check-col">All</th>
                      <th className="iam-check-col">View</th>
                      <th className="iam-check-col">Create</th>
                      <th className="iam-check-col">Update</th>
                      <th className="iam-check-col">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((row) => {
                      const state = matrix[row.menuId] ?? emptyRow();
                      const master = allChecked(state);
                      return (
                        <tr key={row.menuId}>
                          <td>
                            <strong>{row.label}</strong>
                            <span className="muted"> · {row.groupName}</span>
                          </td>
                          <td className="iam-check-col">
                            <input
                              type="checkbox"
                              checked={master}
                              disabled={readOnly}
                              aria-label={`${row.label} all`}
                              onChange={(e) => setMaster(row.menuId, e.target.checked)}
                            />
                          </td>
                          {CRUD_ACTIONS.map((action) => (
                            <td key={action} className="iam-check-col">
                              <input
                                type="checkbox"
                                checked={state[action]}
                                disabled={readOnly}
                                aria-label={`${row.label} ${action}`}
                                onChange={(e) => setRowAction(row.menuId, action, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {!matrixRows.length && (
                      <tr>
                        <td colSpan={6} className="muted">
                          No sidebar menus found for this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid-toolbar">
                <button
                  type="button"
                  className="btn primary"
                  disabled={!selectedRoleId || readOnly || saving}
                  onClick={() => void saveMatrix()}
                >
                  {saving ? 'Saving…' : 'Save permissions'}
                </button>
              </div>
            </>
          ) : (
            <p className="lede muted">Choose a role (or a user for preview) to see the permission matrix.</p>
          )}
        </>
      )}

      {showRoleModal && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowRoleModal(false);
          }}
        >
          <div
            className="search-modal project-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-role-title"
          >
            <div className="search-modal-head">
              <div>
                <h2 id="add-role-title">Add new role</h2>
                <p className="lede">Create an IAM role for {currentOrg.name}.</p>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowRoleModal(false)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="search-modal-body">
              <form className="auth-form compact" onSubmit={(e) => void createRole(e)}>
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
                      pattern="[A-Za-z0-9_-]+"
                      title="Letters, numbers, underscore, hyphen"
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
                <button className="btn primary" type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create role'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
