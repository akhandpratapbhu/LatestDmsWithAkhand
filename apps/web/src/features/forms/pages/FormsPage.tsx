import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { PageHeader } from '../../../components/PageHeader';

type FormListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  layoutType: string;
  description?: string | null;
  _count?: { sections: number; tabs: number; submissions: number };
  linkedMenus?: Array<{ id: string; label: string; path: string | null }>;
};

type FormDetail = {
  id: string;
  name: string;
  code: string;
  status: string;
  layoutType: string;
  tabs: Array<{ id: string; name: string; code: string }>;
  sections: Array<{
    id: string;
    name: string;
    code: string;
    tabId: string | null;
    columns: number;
    controls: Array<{
      id: string;
      fieldKey: string;
      label: string;
      controlType: string;
      required: boolean;
      placeholder: string | null;
      options: unknown;
      validations: Array<{ id: string; ruleType: string; message: string; value: string | null }>;
    }>;
  }>;
};

export function FormsPage() {
  const { user } = useAuth();
  const { organizations, currentOrg, selectOrg } = useOrg();
  const { hasPermission } = useIam();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isPlatformForms = location.pathname.startsWith('/app/forms');
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<FormDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({ name: '', code: '', layoutType: 'TABS' });
  const [tabForm, setTabForm] = useState({ name: '', code: '' });
  const [sectionForm, setSectionForm] = useState({ name: '', code: '', tabId: '', columns: 2 });
  const [controlForm, setControlForm] = useState({
    sectionId: '',
    fieldKey: '',
    label: '',
    controlType: 'TEXT',
    required: true,
  });
  const [editMeta, setEditMeta] = useState({ name: '', description: '', status: 'DRAFT' });
  const [editingControlId, setEditingControlId] = useState<string | null>(null);
  const [editControlLabel, setEditControlLabel] = useState('');

  const canBuildForms =
    user?.isPlatformAdmin ||
    hasPermission('menu.forms') ||
    hasPermission('screen.forms') ||
    hasPermission('api.forms.write');

  // Platform Configure System: honor ?projectId= and keep org header in sync.
  useEffect(() => {
    if (!isPlatformForms) return;
    const fromQuery = searchParams.get('projectId')?.trim();
    if (fromQuery && fromQuery !== currentOrg?.id) {
      const exists = organizations.some((o) => o.id === fromQuery);
      if (exists) selectOrg(fromQuery);
      return;
    }
    if (!fromQuery && currentOrg?.id) {
      const next = new URLSearchParams(searchParams);
      next.set('projectId', currentOrg.id);
      setSearchParams(next, { replace: true });
    }
  }, [isPlatformForms, searchParams, organizations, currentOrg?.id, selectOrg, setSearchParams]);

  function onPlatformProjectChange(orgId: string) {
    selectOrg(orgId);
    setSelectedId('');
    setDetail(null);
    setForms([]);
    setError(null);
    setMessage(null);
    const next = new URLSearchParams(searchParams);
    if (orgId) next.set('projectId', orgId);
    else next.delete('projectId');
    setSearchParams(next, { replace: true });
  }

  async function loadList() {
    const list = await orgApi<FormListItem[]>('/forms');
    setForms(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
    if (selectedId && !list.some((f) => f.id === selectedId)) {
      setSelectedId(list[0]?.id ?? '');
      setDetail(null);
    }
  }

  async function loadDetail(id: string) {
    if (!id) return;
    const d = await orgApi<FormDetail>(`/forms/${id}`);
    setDetail(d);
    setEditMeta({
      name: d.name,
      description: '',
      status: d.status,
    });
    const defaults: Record<string, string> = {};
    d.sections.forEach((s) =>
      s.controls.forEach((c) => {
        defaults[c.fieldKey] = '';
      }),
    );
    setFormValues(defaults);
  }

  useEffect(() => {
    if (!currentOrg) return;
    void loadList().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId).catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [selectedId]);

  const sectionsByTab = useMemo(() => {
    if (!detail) return [];
    if (!detail.tabs.length) {
      return [{ tab: null, sections: detail.sections }];
    }
    return detail.tabs.map((tab) => ({
      tab,
      sections: detail.sections.filter((s) => s.tabId === tab.id),
    }));
  }, [detail]);

  async function onCreateForm(e: FormEvent) {
    e.preventDefault();
    const created = await orgApi<FormListItem>('/forms', {
      method: 'POST',
      body: JSON.stringify(createForm),
    });
    setMessage('Form created');
    setCreateForm({ name: '', code: '', layoutType: 'TABS' });
    await loadList();
    setSelectedId(created.id);
  }

  async function publish() {
    if (!detail) return;
    await orgApi(`/forms/${detail.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    setMessage('Form published');
    await loadDetail(detail.id);
    await loadList();
  }

  async function saveFormMeta(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    await orgApi(`/forms/${detail.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editMeta.name.trim(),
        status: editMeta.status,
      }),
    });
    setMessage('Form updated');
    await loadDetail(detail.id);
    await loadList();
  }

  async function saveControlLabel(controlId: string) {
    const label = editControlLabel.trim();
    if (!label || !detail) return;
    await orgApi(`/forms/controls/${controlId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    });
    setEditingControlId(null);
    setMessage('Field updated');
    await loadDetail(detail.id);
    await loadList();
  }

  async function removeControl(controlId: string) {
    if (!detail) return;
    if (!window.confirm('Delete this field from the form?')) return;
    await orgApi(`/forms/controls/${controlId}`, { method: 'DELETE' });
    setMessage('Field deleted');
    await loadDetail(detail.id);
    await loadList();
  }

  async function addTab(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    await orgApi(`/forms/${detail.id}/tabs`, {
      method: 'POST',
      body: JSON.stringify(tabForm),
    });
    setTabForm({ name: '', code: '' });
    await loadDetail(detail.id);
  }

  async function addSection(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    await orgApi(`/forms/${detail.id}/sections`, {
      method: 'POST',
      body: JSON.stringify({
        ...sectionForm,
        tabId: sectionForm.tabId || undefined,
        columns: Number(sectionForm.columns),
      }),
    });
    setSectionForm({ name: '', code: '', tabId: '', columns: 2 });
    await loadDetail(detail.id);
  }

  async function addControl(e: FormEvent) {
    e.preventDefault();
    if (!detail || !controlForm.sectionId) return;
    await orgApi(`/forms/sections/${controlForm.sectionId}/controls`, {
      method: 'POST',
      body: JSON.stringify({
        fieldKey: controlForm.fieldKey,
        label: controlForm.label,
        controlType: controlForm.controlType,
        required: controlForm.required,
        validations: controlForm.required
          ? [{ ruleType: 'REQUIRED', message: `${controlForm.label} is required` }]
          : [],
        options:
          controlForm.controlType === 'SELECT'
            ? [
                { label: 'Option A', value: 'A' },
                { label: 'Option B', value: 'B' },
              ]
            : [],
      }),
    });
    setControlForm({
      sectionId: controlForm.sectionId,
      fieldKey: '',
      label: '',
      controlType: 'TEXT',
      required: true,
    });
    await loadDetail(detail.id);
  }

  async function submitPreview(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    try {
      await orgApi(`/forms/${detail.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ data: formValues }),
      });
      setMessage('Form submitted successfully');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  }

  if (!currentOrg && !isPlatformForms) {
    return (
      <section className="panel">
        <h1>Forms</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!canBuildForms) {
    return (
      <section className="panel">
        <h1>Forms</h1>
        <div className="alert error">Not authorized.</div>
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dynamic Form Builder"
        description={
          isPlatformForms
            ? 'Configure forms for a selected project from Configure System. Forms stay scoped to that project.'
            : 'Create forms with tabs, sections, controls, validation, and layout.'
        }
      />

      {isPlatformForms ? (
        <section className="section-card" style={{ marginBottom: '1rem' }}>
          <div className="section-card-body">
            <label className="inline-field">
              Project
              <select
                value={currentOrg?.id ?? ''}
                onChange={(e) => onPlatformProjectChange(e.target.value)}
                aria-label="Select project for forms"
              >
                <option value="" disabled>
                  Select a project…
                </option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.slug ? ` (${o.slug})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted tiny" style={{ margin: '0.5rem 0 0' }}>
              Forms are created for the selected project via <code>X-Organization-Id</code>. Open the
              project workspace to use published forms with end users.
            </p>
          </div>
        </section>
      ) : null}

      {!currentOrg ? (
        <section className="panel">
          <p className="lede">Select a project above to manage its forms.</p>
        </section>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <section className="section-card" style={{ marginBottom: '1rem' }}>
            <div className="section-card-head">
              <h2>
                Forms · {currentOrg.name}
                <span className="muted" style={{ fontWeight: 400, marginLeft: '0.5rem' }}>
                  ({forms.length} form{forms.length === 1 ? '' : 's'})
                </span>
              </h2>
            </div>
            <div className="section-card-body" style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Form</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Fields</th>
                    <th>Linked menus</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f) => (
                    <tr key={f.id} className={selectedId === f.id ? 'is-selected' : undefined}>
                      <td>
                        <strong>{f.name}</strong>
                      </td>
                      <td>
                        <code>{f.code}</code>
                      </td>
                      <td>{f.status}</td>
                      <td>{f._count?.sections ?? 0} sections</td>
                      <td>
                        {(f.linkedMenus?.length ?? 0) === 0 ? (
                          <span className="muted">Not linked</span>
                        ) : (
                          f.linkedMenus!.map((m) => m.label).join(', ')
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setSelectedId(f.id)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!forms.length && (
                    <tr>
                      <td colSpan={6} className="muted">
                        No forms yet for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section-card">
            <div className="section-card-body">
              <form className="auth-form compact" onSubmit={(e) => void onCreateForm(e)}>
                <h2>New form{isPlatformForms ? ` · ${currentOrg.name}` : ''}</h2>
                <div className="row-2">
                  <label>
                    Name
                    <input
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </label>
                  <label>
                    Code
                    <input
                      required
                      value={createForm.code}
                      onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </label>
                </div>
                <label>
                  Layout
                  <select
                    value={createForm.layoutType}
                    onChange={(e) => setCreateForm((f) => ({ ...f, layoutType: e.target.value }))}
                  >
                    <option value="TABS">TABS</option>
                    <option value="GRID">GRID</option>
                    <option value="STACK">STACK</option>
                  </select>
                </label>
                <button className="btn primary" type="submit">
                  Create form
                </button>
              </form>

              <label className="inline-field">
                Edit form
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.status})
                    </option>
                  ))}
                </select>
              </label>

              {detail && (
                <>
                  <div className="action-row">
                    <button className="btn secondary" type="button" onClick={() => void publish()}>
                      Publish form
                    </button>
                    <span className="muted">
                      Layout: {detail.layoutType} · Tabs: {detail.tabs.length} · Sections:{' '}
                      {detail.sections.length}
                    </span>
                  </div>

                  <form className="auth-form compact" onSubmit={(e) => void saveFormMeta(e)}>
                    <h2>Update form</h2>
                    <div className="row-2">
                      <label>
                        Name
                        <input
                          required
                          value={editMeta.name}
                          onChange={(e) => setEditMeta((m) => ({ ...m, name: e.target.value }))}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={editMeta.status}
                          onChange={(e) => setEditMeta((m) => ({ ...m, status: e.target.value }))}
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="PUBLISHED">PUBLISHED</option>
                        </select>
                      </label>
                    </div>
                    <button className="btn primary" type="submit">
                      Save form
                    </button>
                  </form>

                  <form className="auth-form compact" onSubmit={(e) => void addTab(e)}>
                    <h2>Add tab</h2>
                    <div className="row-2">
                      <label>
                        Name
                        <input
                          required
                          value={tabForm.name}
                          onChange={(e) => setTabForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </label>
                      <label>
                        Code
                        <input
                          required
                          value={tabForm.code}
                          onChange={(e) => setTabForm((f) => ({ ...f, code: e.target.value }))}
                        />
                      </label>
                    </div>
                    <button className="btn secondary" type="submit">
                      Add tab
                    </button>
                  </form>

                  <form className="auth-form compact" onSubmit={(e) => void addSection(e)}>
                    <h2>Add section</h2>
                    <div className="row-2">
                      <label>
                        Name
                        <input
                          required
                          value={sectionForm.name}
                          onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </label>
                      <label>
                        Code
                        <input
                          required
                          value={sectionForm.code}
                          onChange={(e) => setSectionForm((f) => ({ ...f, code: e.target.value }))}
                        />
                      </label>
                    </div>
                    <label>
                      Tab
                      <select
                        value={sectionForm.tabId}
                        onChange={(e) => setSectionForm((f) => ({ ...f, tabId: e.target.value }))}
                      >
                        <option value="">None</option>
                        {detail.tabs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn secondary" type="submit">
                      Add section
                    </button>
                  </form>

                  <form className="auth-form compact" onSubmit={(e) => void addControl(e)}>
                    <h2>Add control</h2>
                    <label>
                      Section
                      <select
                        required
                        value={controlForm.sectionId}
                        onChange={(e) =>
                          setControlForm((f) => ({ ...f, sectionId: e.target.value }))
                        }
                      >
                        <option value="">Select</option>
                        {detail.sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="row-2">
                      <label>
                        Field key
                        <input
                          required
                          value={controlForm.fieldKey}
                          onChange={(e) =>
                            setControlForm((f) => ({ ...f, fieldKey: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Label
                        <input
                          required
                          value={controlForm.label}
                          onChange={(e) =>
                            setControlForm((f) => ({ ...f, label: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Type
                      <select
                        value={controlForm.controlType}
                        onChange={(e) =>
                          setControlForm((f) => ({ ...f, controlType: e.target.value }))
                        }
                      >
                        <option value="TEXT">TEXT</option>
                        <option value="TEXTAREA">TEXTAREA</option>
                        <option value="NUMBER">NUMBER</option>
                        <option value="EMAIL">EMAIL</option>
                        <option value="SELECT">SELECT</option>
                        <option value="CHECKBOX">CHECKBOX</option>
                        <option value="DATE">DATE</option>
                      </select>
                    </label>
                    <button className="btn secondary" type="submit">
                      Add control
                    </button>
                  </form>

                  <form className="auth-form compact" onSubmit={(e) => void submitPreview(e)}>
                    <h2>Preview / submit</h2>
                    {sectionsByTab.map(({ tab, sections }) => (
                      <div key={tab?.id ?? 'root'} className="form-tab-block">
                        {tab && <h3 className="tab-heading">{tab.name}</h3>}
                        {sections.map((section) => (
                          <div key={section.id} className="form-section-block">
                            <h4>{section.name}</h4>
                            <div
                              className="form-controls-grid"
                              style={{
                                gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
                              }}
                            >
                              {section.controls.map((c) => (
                                <div key={c.id} className="form-control-edit">
                                  {editingControlId === c.id ? (
                                    <div className="row-2" style={{ alignItems: 'end' }}>
                                      <label>
                                        Field label
                                        <input
                                          value={editControlLabel}
                                          onChange={(e) => setEditControlLabel(e.target.value)}
                                        />
                                      </label>
                                      <div className="action-row">
                                        <button
                                          type="button"
                                          className="btn primary sm"
                                          onClick={() => void saveControlLabel(c.id)}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="btn ghost sm"
                                          onClick={() => setEditingControlId(null)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="action-row" style={{ marginBottom: '0.35rem' }}>
                                      <strong>
                                        {c.label}
                                        {c.required ? ' *' : ''}
                                      </strong>
                                      <span className="muted tiny">{c.controlType}</span>
                                      <button
                                        type="button"
                                        className="btn ghost sm"
                                        onClick={() => {
                                          setEditingControlId(c.id);
                                          setEditControlLabel(c.label);
                                        }}
                                      >
                                        Rename
                                      </button>
                                      <button
                                        type="button"
                                        className="btn ghost sm"
                                        onClick={() => void removeControl(c.id)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                  <label>
                                    {c.controlType === 'TEXTAREA' ? (
                                      <textarea
                                        value={formValues[c.fieldKey] ?? ''}
                                        onChange={(e) =>
                                          setFormValues((v) => ({
                                            ...v,
                                            [c.fieldKey]: e.target.value,
                                          }))
                                        }
                                      />
                                    ) : c.controlType === 'SELECT' ? (
                                      <select
                                        value={formValues[c.fieldKey] ?? ''}
                                        onChange={(e) =>
                                          setFormValues((v) => ({
                                            ...v,
                                            [c.fieldKey]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">Select</option>
                                        {(Array.isArray(c.options) ? c.options : []).map(
                                          (opt, idx) => {
                                            const o = opt as { label?: string; value?: string };
                                            return (
                                              <option key={idx} value={o.value ?? ''}>
                                                {o.label ?? o.value}
                                              </option>
                                            );
                                          },
                                        )}
                                      </select>
                                    ) : c.controlType === 'CHECKBOX' ? (
                                      <input
                                        type="checkbox"
                                        checked={formValues[c.fieldKey] === 'true'}
                                        onChange={(e) =>
                                          setFormValues((v) => ({
                                            ...v,
                                            [c.fieldKey]: e.target.checked ? 'true' : 'false',
                                          }))
                                        }
                                      />
                                    ) : (
                                      <input
                                        type={
                                          c.controlType === 'NUMBER'
                                            ? 'number'
                                            : c.controlType === 'EMAIL'
                                              ? 'email'
                                              : c.controlType === 'DATE'
                                                ? 'date'
                                                : 'text'
                                        }
                                        placeholder={c.placeholder ?? undefined}
                                        value={formValues[c.fieldKey] ?? ''}
                                        onChange={(e) =>
                                          setFormValues((v) => ({
                                            ...v,
                                            [c.fieldKey]: e.target.value,
                                          }))
                                        }
                                      />
                                    )}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <button className="btn primary" type="submit">
                      Submit
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
