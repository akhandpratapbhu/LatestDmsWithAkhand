import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { formDataAppPath } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { PageHeader } from '../../../components/PageHeader';

type FormOption = {
  id: string;
  name: string;
  code: string;
  status: string;
};

type MenuRow = {
  id: string;
  label: string;
  path: string | null;
  icon: string | null;
  formId: string | null;
  sortOrder: number;
  parentId: string | null;
  groupId: string | null;
  isActive: boolean;
  children?: MenuRow[];
};

type MenuGroupRow = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  isOuter?: boolean;
  menus: MenuRow[];
};

type CreateMode = 'main' | 'submenu';

type MainDraft = {
  name: string;
  sortOrder: string;
  isActive: boolean;
};

type SubmenuDraft = {
  label: string;
  parentMainId: string;
  formId: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
};

type EditTarget =
  | { kind: 'main'; id: string }
  | { kind: 'submenu'; id: string };

const emptyMainDraft = (): MainDraft => ({
  name: '',
  sortOrder: '0',
  isActive: true,
});

const emptySubmenuDraft = (): SubmenuDraft => ({
  label: '',
  parentMainId: '',
  formId: '',
  icon: '',
  sortOrder: '0',
  isActive: true,
});

function ProjectField({
  value,
  onChange,
  options,
  required = true,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; name: string }>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label>
      Project
      <select
        required={required}
        disabled={disabled || options.length === 0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select a project…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MenuBuilderPage() {
  const { organizations, currentOrg } = useOrg();
  const { hasPermission, refreshSidebar, refreshProjectSidebars } = useIam();
  const [selectedProjectId, setSelectedProjectId] = useState(currentOrg?.id ?? '');
  const [groups, setGroups] = useState<MenuGroupRow[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<CreateMode>('main');
  const [mainDraft, setMainDraft] = useState<MainDraft>(emptyMainDraft);
  const [submenuDraft, setSubmenuDraft] = useState<SubmenuDraft>(emptySubmenuDraft);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editMain, setEditMain] = useState<MainDraft>(emptyMainDraft);
  const [editSubmenu, setEditSubmenu] = useState<SubmenuDraft>(emptySubmenuDraft);
  const [busy, setBusy] = useState(false);

  const projectOptions = useMemo(
    () => organizations.map((o) => ({ id: o.id, name: o.name })),
    [organizations],
  );

  const selectedProject = useMemo(
    () => organizations.find((o) => o.id === selectedProjectId) ?? null,
    [organizations, selectedProjectId],
  );

  const mainMenus = useMemo(
    () => groups.filter((g) => !g.isOuter && g.id !== '__outer__'),
    [groups],
  );

  useEffect(() => {
    if (currentOrg?.id && !selectedProjectId) {
      setSelectedProjectId(currentOrg.id);
    }
  }, [currentOrg?.id, selectedProjectId]);

  const load = useCallback(async (organizationId: string) => {
    const [menuGroups, formList] = await Promise.all([
      orgApi<MenuGroupRow[]>('/iam/menu-groups', { organizationId }),
      orgApi<FormOption[]>('/forms', { organizationId }).catch(() => [] as FormOption[]),
    ]);
    setGroups(
      menuGroups.map((g) => ({
        ...g,
        isOuter: g.isOuter || g.code === '_OUTER' || g.id === '__outer__',
        isActive: g.isActive ?? true,
      })),
    );
    setForms(formList.filter((f) => f.status === 'PUBLISHED' || f.status === 'DRAFT'));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    void load(selectedProjectId).catch((e) =>
      setError(e instanceof Error ? e.message : 'Failed to load'),
    );
  }, [selectedProjectId, load]);

  function onSelectProject(id: string) {
    setSelectedProjectId(id);
    setEditing(null);
    setSubmenuDraft((d) => ({ ...d, parentMainId: '', formId: '' }));
    setMessage(null);
    setError(null);
  }

  async function afterMutation() {
    if (!selectedProjectId) return;
    await load(selectedProjectId);
    if (selectedProjectId === currentOrg?.id) {
      await refreshSidebar();
    }
    await refreshProjectSidebars();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Select a project for this menu');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'main') {
        await orgApi('/iam/menu-groups', {
          method: 'POST',
          organizationId: selectedProjectId,
          body: JSON.stringify({
            name: mainDraft.name.trim(),
            sortOrder: Number(mainDraft.sortOrder) || 0,
            isActive: mainDraft.isActive,
            organizationId: selectedProjectId,
          }),
        });
        setMessage(`Main menu created for ${selectedProject?.name ?? 'project'}`);
        setMainDraft(emptyMainDraft());
      } else {
        const formId = submenuDraft.formId || undefined;
        await orgApi('/iam/menus', {
          method: 'POST',
          organizationId: selectedProjectId,
          body: JSON.stringify({
            label: submenuDraft.label.trim(),
            groupId: submenuDraft.parentMainId || undefined,
            formId,
            path: formId ? formDataAppPath(formId) : undefined,
            icon: submenuDraft.icon.trim() || undefined,
            sortOrder: Number(submenuDraft.sortOrder) || 0,
            isActive: submenuDraft.isActive,
            organizationId: selectedProjectId,
          }),
        });
        setMessage(
          submenuDraft.parentMainId
            ? `Submenu created under main menu (${selectedProject?.name ?? 'project'})`
            : `Outer top-level item created (${selectedProject?.name ?? 'project'})`,
        );
        setSubmenuDraft(emptySubmenuDraft());
      }
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function startEditMain(group: MenuGroupRow) {
    setEditing({ kind: 'main', id: group.id });
    setEditMain({
      name: group.name,
      sortOrder: String(group.sortOrder ?? 0),
      isActive: group.isActive ?? true,
    });
    setMessage(null);
    setError(null);
  }

  function startEditSubmenu(menu: MenuRow, groupId: string | null) {
    setEditing({ kind: 'submenu', id: menu.id });
    setEditSubmenu({
      label: menu.label,
      parentMainId: menu.groupId ?? (groupId && groupId !== '__outer__' ? groupId : ''),
      formId: menu.formId ?? '',
      icon: menu.icon ?? '',
      sortOrder: String(menu.sortOrder ?? 0),
      isActive: menu.isActive ?? true,
    });
    setMessage(null);
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !selectedProjectId) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.kind === 'main') {
        await orgApi(`/iam/menu-groups/${editing.id}`, {
          method: 'PATCH',
          organizationId: selectedProjectId,
          body: JSON.stringify({
            name: editMain.name.trim(),
            sortOrder: Number(editMain.sortOrder) || 0,
            isActive: editMain.isActive,
            organizationId: selectedProjectId,
          }),
        });
        setMessage('Main menu updated');
      } else {
        const formId = editSubmenu.formId || null;
        await orgApi(`/iam/menus/${editing.id}`, {
          method: 'PATCH',
          organizationId: selectedProjectId,
          body: JSON.stringify({
            label: editSubmenu.label.trim(),
            groupId: editSubmenu.parentMainId || null,
            formId,
            path: formId ? formDataAppPath(formId) : null,
            icon: editSubmenu.icon.trim() || null,
            sortOrder: Number(editSubmenu.sortOrder) || 0,
            isActive: editSubmenu.isActive,
            organizationId: selectedProjectId,
          }),
        });
        setMessage('Submenu updated');
      }
      setEditing(null);
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMain(groupId: string) {
    if (!window.confirm('Delete this main menu? Submenus must be removed first.')) return;
    if (!selectedProjectId) return;
    setBusy(true);
    setError(null);
    try {
      await orgApi(`/iam/menu-groups/${groupId}`, {
        method: 'DELETE',
        organizationId: selectedProjectId,
      });
      setMessage('Main menu deleted');
      if (editing?.kind === 'main' && editing.id === groupId) setEditing(null);
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSubmenu(menuId: string) {
    if (!window.confirm('Delete this menu item?')) return;
    if (!selectedProjectId) return;
    setBusy(true);
    setError(null);
    try {
      await orgApi(`/iam/menus/${menuId}`, {
        method: 'DELETE',
        organizationId: selectedProjectId,
      });
      setMessage('Menu deleted');
      if (editing?.kind === 'submenu' && editing.id === menuId) setEditing(null);
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function moveSubmenu(menu: MenuRow, delta: number) {
    if (!selectedProjectId) return;
    setBusy(true);
    try {
      await orgApi(`/iam/menus/${menu.id}`, {
        method: 'PATCH',
        organizationId: selectedProjectId,
        body: JSON.stringify({
          sortOrder: (menu.sortOrder ?? 0) + delta,
          organizationId: selectedProjectId,
        }),
      });
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setBusy(false);
    }
  }

  async function moveMain(group: MenuGroupRow, delta: number) {
    if (!selectedProjectId) return;
    setBusy(true);
    try {
      await orgApi(`/iam/menu-groups/${group.id}`, {
        method: 'PATCH',
        organizationId: selectedProjectId,
        body: JSON.stringify({
          sortOrder: (group.sortOrder ?? 0) + delta,
          organizationId: selectedProjectId,
        }),
      });
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setBusy(false);
    }
  }

  function renderSubmenuEditForm() {
    return (
      <form className="auth-form compact" onSubmit={(e) => void onSaveEdit(e)}>
        <ProjectField
          value={selectedProjectId}
          onChange={onSelectProject}
          options={projectOptions}
          disabled
        />
        <div className="row-2">
          <label>
            Label
            <input
              required
              value={editSubmenu.label}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, label: e.target.value }))}
            />
          </label>
          <label>
            Parent main menu
            <select
              value={editSubmenu.parentMainId}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, parentMainId: e.target.value }))}
            >
              <option value="">None — outer top-level</option>
              {mainMenus.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row-2">
          <label>
            Link to form
            <select
              value={editSubmenu.formId}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, formId: e.target.value }))}
            >
              <option value="">None</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Icon
            <input
              value={editSubmenu.icon}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, icon: e.target.value }))}
              placeholder="form"
            />
          </label>
        </div>
        <div className="row-2">
          <label>
            Sort order
            <input
              type="number"
              value={editSubmenu.sortOrder}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, sortOrder: e.target.value }))}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editSubmenu.isActive}
              onChange={(e) => setEditSubmenu((d) => ({ ...d, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>
        <div className="action-row">
          <button className="btn primary" type="submit" disabled={busy}>
            Save
          </button>
          <button className="btn secondary" type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderMenuRow(menu: MenuRow, groupId: string | null) {
    if (editing?.kind === 'submenu' && editing.id === menu.id) {
      return renderSubmenuEditForm();
    }
    return (
      <div className="menu-builder-row">
        <div>
          <strong>{menu.label}</strong>
          {!menu.isActive && <span className="muted tiny"> · inactive</span>}
          <span className="muted tiny">
            {' '}
            · {menu.formId ? `form → /app/data/${menu.formId}` : menu.path || 'no path'}
          </span>
        </div>
        <div className="action-row">
          <button type="button" className="btn ghost" onClick={() => void moveSubmenu(menu, -1)} disabled={busy}>
            ↑
          </button>
          <button type="button" className="btn ghost" onClick={() => void moveSubmenu(menu, 1)} disabled={busy}>
            ↓
          </button>
          <button type="button" className="btn secondary" onClick={() => startEditSubmenu(menu, groupId)}>
            Edit
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void onDeleteSubmenu(menu.id)}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Menus</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  if (!hasPermission('menu.menus') && !hasPermission('screen.menus')) {
    return (
      <section className="panel">
        <h1>Menus</h1>
        <div className="alert error">Not authorized.</div>
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Menu Builder"
        description="Create main menus (sidebar sections) and submenus for a specific project — nested under that project in the platform sidebar."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-head">
          <h2>Add menu</h2>
        </div>
        <div className="section-card-body">
          <div className="segmented" role="tablist" aria-label="Create mode">
            <button
              type="button"
              className={`btn ${mode === 'main' ? 'active' : ''}`}
              role="tab"
              aria-selected={mode === 'main'}
              onClick={() => setMode('main')}
            >
              Main menu
            </button>
            <button
              type="button"
              className={`btn ${mode === 'submenu' ? 'active' : ''}`}
              role="tab"
              aria-selected={mode === 'submenu'}
              onClick={() => setMode('submenu')}
            >
              Submenu
            </button>
          </div>

          <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
            <ProjectField
              value={selectedProjectId}
              onChange={onSelectProject}
              options={projectOptions}
            />
            {mode === 'main' ? (
              <>
                <div className="row-2">
                  <label>
                    Name
                    <input
                      required
                      value={mainDraft.name}
                      onChange={(e) => setMainDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Workspace"
                    />
                  </label>
                  <label>
                    Sort order
                    <input
                      type="number"
                      value={mainDraft.sortOrder}
                      onChange={(e) => setMainDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={mainDraft.isActive}
                    onChange={(e) => setMainDraft((d) => ({ ...d, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <p className="muted tiny">
                  A main menu is a top-level sidebar section under the selected project. Add
                  submenus under it next.
                </p>
                <button className="btn primary" type="submit" disabled={busy || !selectedProjectId}>
                  Create main menu
                </button>
              </>
            ) : (
              <>
                <div className="row-2">
                  <label>
                    Label
                    <input
                      required
                      value={submenuDraft.label}
                      onChange={(e) => setSubmenuDraft((d) => ({ ...d, label: e.target.value }))}
                      placeholder="e.g. Dashboard"
                    />
                  </label>
                  <label>
                    Parent main menu
                    <select
                      value={submenuDraft.parentMainId}
                      onChange={(e) =>
                        setSubmenuDraft((d) => ({ ...d, parentMainId: e.target.value }))
                      }
                    >
                      <option value="">None — outer top-level</option>
                      {mainMenus.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="row-2">
                  <label>
                    Link to form (optional)
                    <select
                      value={submenuDraft.formId}
                      onChange={(e) => setSubmenuDraft((d) => ({ ...d, formId: e.target.value }))}
                    >
                      <option value="">None</option>
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Icon (optional)
                    <input
                      value={submenuDraft.icon}
                      onChange={(e) => setSubmenuDraft((d) => ({ ...d, icon: e.target.value }))}
                      placeholder="form"
                    />
                  </label>
                </div>
                <div className="row-2">
                  <label>
                    Sort order
                    <input
                      type="number"
                      value={submenuDraft.sortOrder}
                      onChange={(e) =>
                        setSubmenuDraft((d) => ({ ...d, sortOrder: e.target.value }))
                      }
                    />
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={submenuDraft.isActive}
                      onChange={(e) =>
                        setSubmenuDraft((d) => ({ ...d, isActive: e.target.checked }))
                      }
                    />
                    Active
                  </label>
                </div>
                <p className="muted tiny">
                  Parent main menus listed are only for the selected project. Leave parent empty
                  for an outer top-level item.
                </p>
                <button className="btn primary" type="submit" disabled={busy || !selectedProjectId}>
                  Create submenu
                </button>
              </>
            )}
          </form>
        </div>
      </section>

      <section className="section-card">
        <div className="section-card-head">
          <h2>
            Current menus
            {selectedProject ? (
              <span className="muted tiny"> · {selectedProject.name}</span>
            ) : null}
          </h2>
        </div>
        <div className="section-card-body">
          {groups.length === 0 && <p className="muted tiny">No menus yet for this project.</p>}
          {groups.map((group) => (
            <div key={group.id} className="menu-builder-group">
              {group.isOuter ? (
                <h3>Outer top-level items</h3>
              ) : editing?.kind === 'main' && editing.id === group.id ? (
                <form className="auth-form compact" onSubmit={(e) => void onSaveEdit(e)}>
                  <ProjectField
                    value={selectedProjectId}
                    onChange={onSelectProject}
                    options={projectOptions}
                    disabled
                  />
                  <div className="row-2">
                    <label>
                      Name
                      <input
                        required
                        value={editMain.name}
                        onChange={(e) => setEditMain((d) => ({ ...d, name: e.target.value }))}
                      />
                    </label>
                    <label>
                      Sort order
                      <input
                        type="number"
                        value={editMain.sortOrder}
                        onChange={(e) => setEditMain((d) => ({ ...d, sortOrder: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={editMain.isActive}
                      onChange={(e) => setEditMain((d) => ({ ...d, isActive: e.target.checked }))}
                    />
                    Active
                  </label>
                  <div className="action-row">
                    <button className="btn primary" type="submit" disabled={busy}>
                      Save
                    </button>
                    <button className="btn secondary" type="button" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="menu-builder-row">
                  <h3>
                    {group.name}
                    <span className="muted tiny"> · main menu</span>
                    {!group.isActive && <span className="muted tiny"> · inactive</span>}
                  </h3>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void moveMain(group, -1)}
                      disabled={busy}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void moveMain(group, 1)}
                      disabled={busy}
                    >
                      ↓
                    </button>
                    <button type="button" className="btn secondary" onClick={() => startEditMain(group)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void onDeleteMain(group.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {group.menus.length === 0 && !group.isOuter && (
                <p className="muted tiny">No submenus in this main menu yet.</p>
              )}
              <ul className="menu-builder-list">
                {group.menus.map((menu) => (
                  <li key={menu.id}>
                    {renderMenuRow(menu, group.isOuter ? null : group.id)}
                    {menu.children && menu.children.length > 0 && (
                      <ul className="menu-builder-children">
                        {menu.children.map((child) => (
                          <li key={child.id}>
                            {renderMenuRow(child, group.isOuter ? null : group.id)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
