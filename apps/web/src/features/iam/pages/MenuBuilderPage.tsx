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
  menus: MenuRow[];
};

type Draft = {
  label: string;
  groupId: string;
  parentId: string;
  formId: string;
  icon: string;
  sortOrder: string;
};

const emptyDraft = (): Draft => ({
  label: '',
  groupId: '',
  parentId: '',
  formId: '',
  icon: '',
  sortOrder: '0',
});

export function MenuBuilderPage() {
  const { currentOrg } = useOrg();
  const { hasPermission, refreshSidebar } = useIam();
  const [groups, setGroups] = useState<MenuGroupRow[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const flatParents = useMemo(() => {
    const rows: Array<{ id: string; label: string; groupName: string }> = [];
    for (const g of groups) {
      for (const m of g.menus) {
        rows.push({ id: m.id, label: m.label, groupName: g.name });
      }
    }
    return rows;
  }, [groups]);

  const load = useCallback(async () => {
    const [menuGroups, formList] = await Promise.all([
      orgApi<MenuGroupRow[]>('/iam/menu-groups'),
      orgApi<FormOption[]>('/forms').catch(() => [] as FormOption[]),
    ]);
    setGroups(menuGroups);
    setForms(formList.filter((f) => f.status === 'PUBLISHED' || f.status === 'DRAFT'));
    if (!draft.groupId && menuGroups[0]) {
      setDraft((d) => ({ ...d, groupId: menuGroups[0].id }));
    }
  }, [draft.groupId]);

  useEffect(() => {
    if (!currentOrg) return;
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [currentOrg?.id]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const formId = draft.formId || undefined;
      await orgApi('/iam/menus', {
        method: 'POST',
        body: JSON.stringify({
          label: draft.label.trim(),
          groupId: draft.parentId ? undefined : draft.groupId || undefined,
          parentId: draft.parentId || undefined,
          formId,
          path: formId ? formDataAppPath(formId) : undefined,
          icon: draft.icon.trim() || undefined,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      });
      setMessage(draft.parentId ? 'Submenu created' : 'Menu created');
      setDraft((d) => ({ ...emptyDraft(), groupId: d.groupId }));
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(menu: MenuRow, groupId: string) {
    setEditingId(menu.id);
    setEditDraft({
      label: menu.label,
      groupId: menu.groupId ?? groupId,
      parentId: menu.parentId ?? '',
      formId: menu.formId ?? '',
      icon: menu.icon ?? '',
      sortOrder: String(menu.sortOrder ?? 0),
    });
    setMessage(null);
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      const formId = editDraft.formId || null;
      await orgApi(`/iam/menus/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          label: editDraft.label.trim(),
          groupId: editDraft.parentId ? undefined : editDraft.groupId || null,
          parentId: editDraft.parentId || null,
          formId,
          path: formId ? formDataAppPath(formId) : null,
          icon: editDraft.icon.trim() || null,
          sortOrder: Number(editDraft.sortOrder) || 0,
        }),
      });
      setMessage('Menu updated');
      setEditingId(null);
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(menuId: string) {
    if (!window.confirm('Delete this menu item?')) return;
    setBusy(true);
    setError(null);
    try {
      await orgApi(`/iam/menus/${menuId}`, { method: 'DELETE' });
      setMessage('Menu deleted');
      if (editingId === menuId) setEditingId(null);
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function move(menu: MenuRow, delta: number) {
    setBusy(true);
    try {
      await orgApi(`/iam/menus/${menu.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sortOrder: (menu.sortOrder ?? 0) + delta }),
      });
      await load();
      await refreshSidebar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setBusy(false);
    }
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
        description="Create sidebar menus and submenus, then link them to a dynamic form. Linked items open a records grid with Add."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-head">
          <h2>Add menu item</h2>
        </div>
        <div className="section-card-body">
          <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
            <div className="row-2">
              <label>
                Label
                <input
                  required
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Sale or Stock"
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                />
              </label>
            </div>
            <div className="row-2">
              <label>
                Group
                <select
                  required={!draft.parentId}
                  disabled={Boolean(draft.parentId)}
                  value={draft.groupId}
                  onChange={(e) => setDraft((d) => ({ ...d, groupId: e.target.value }))}
                >
                  <option value="">Select group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parent menu (optional submenu)
                <select
                  value={draft.parentId}
                  onChange={(e) => setDraft((d) => ({ ...d, parentId: e.target.value }))}
                >
                  <option value="">Top-level</option>
                  {flatParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.groupName} / {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row-2">
              <label>
                Link to form (optional)
                <select
                  value={draft.formId}
                  onChange={(e) => setDraft((d) => ({ ...d, formId: e.target.value }))}
                >
                  <option value="">None (folder / custom path)</option>
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
                  value={draft.icon}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                  placeholder="form"
                />
              </label>
            </div>
            <p className="muted tiny">
              Tip: create parent <strong>Sale</strong> with no form, then add child <strong>Stock</strong> under
              it and link a published form.
            </p>
            <button className="btn primary" type="submit" disabled={busy}>
              Create
            </button>
          </form>
        </div>
      </section>

      <section className="section-card">
        <div className="section-card-head">
          <h2>Current menus</h2>
        </div>
        <div className="section-card-body">
          {groups.map((group) => (
            <div key={group.id} className="menu-builder-group">
              <h3>{group.name}</h3>
              {group.menus.length === 0 && <p className="muted tiny">No top-level menus in this group.</p>}
              <ul className="menu-builder-list">
                {group.menus.map((menu) => (
                  <li key={menu.id}>
                    {editingId === menu.id ? (
                      <form className="auth-form compact" onSubmit={(e) => void onSaveEdit(e)}>
                        <div className="row-2">
                          <label>
                            Label
                            <input
                              required
                              value={editDraft.label}
                              onChange={(e) => setEditDraft((d) => ({ ...d, label: e.target.value }))}
                            />
                          </label>
                          <label>
                            Form
                            <select
                              value={editDraft.formId}
                              onChange={(e) => setEditDraft((d) => ({ ...d, formId: e.target.value }))}
                            >
                              <option value="">None</option>
                              {forms.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="action-row">
                          <button className="btn primary" type="submit" disabled={busy}>
                            Save
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="menu-builder-row">
                        <div>
                          <strong>{menu.label}</strong>
                          <span className="muted tiny">
                            {' '}
                            · {menu.formId ? `form → /app/data/${menu.formId}` : menu.path || 'no path (folder)'}
                          </span>
                        </div>
                        <div className="action-row">
                          <button type="button" className="btn ghost" onClick={() => void move(menu, -1)} disabled={busy}>
                            ↑
                          </button>
                          <button type="button" className="btn ghost" onClick={() => void move(menu, 1)} disabled={busy}>
                            ↓
                          </button>
                          <button type="button" className="btn secondary" onClick={() => startEdit(menu, group.id)}>
                            Edit
                          </button>
                          <button type="button" className="btn ghost" onClick={() => void onDelete(menu.id)} disabled={busy}>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                    {menu.children && menu.children.length > 0 && (
                      <ul className="menu-builder-children">
                        {menu.children.map((child) => (
                          <li key={child.id}>
                            {editingId === child.id ? (
                              <form className="auth-form compact" onSubmit={(e) => void onSaveEdit(e)}>
                                <div className="row-2">
                                  <label>
                                    Label
                                    <input
                                      required
                                      value={editDraft.label}
                                      onChange={(e) =>
                                        setEditDraft((d) => ({ ...d, label: e.target.value }))
                                      }
                                    />
                                  </label>
                                  <label>
                                    Form
                                    <select
                                      value={editDraft.formId}
                                      onChange={(e) =>
                                        setEditDraft((d) => ({ ...d, formId: e.target.value }))
                                      }
                                    >
                                      <option value="">None</option>
                                      {forms.map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <div className="action-row">
                                  <button className="btn primary" type="submit" disabled={busy}>
                                    Save
                                  </button>
                                  <button
                                    className="btn secondary"
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <div className="menu-builder-row">
                                <div>
                                  <strong>{child.label}</strong>
                                  <span className="muted tiny">
                                    {' '}
                                    ·{' '}
                                    {child.formId
                                      ? `form → /app/data/${child.formId}`
                                      : child.path || 'no path'}
                                  </span>
                                </div>
                                <div className="action-row">
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={() => void move(child, -1)}
                                    disabled={busy}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={() => void move(child, 1)}
                                    disabled={busy}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="btn secondary"
                                    onClick={() => startEdit(child, group.id)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={() => void onDelete(child.id)}
                                    disabled={busy}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
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
