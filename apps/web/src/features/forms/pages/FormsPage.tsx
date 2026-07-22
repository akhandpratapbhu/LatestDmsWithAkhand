import { FormEvent, useEffect, useMemo, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';

type FormListItem = {
  id: string;
  name: string;
  code: string;
  status: string;
  layoutType: string;
  _count?: { sections: number; tabs: number; submissions: number };
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
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
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

  async function loadList() {
    const list = await orgApi<FormListItem[]>('/forms');
    setForms(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }

  async function loadDetail(id: string) {
    if (!id) return;
    const d = await orgApi<FormDetail>(`/forms/${id}`);
    setDetail(d);
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

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Forms</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!hasPermission('menu.forms') && !hasPermission('screen.forms')) {
    return (
      <section className="panel">
        <h1>Forms</h1>
        <div className="alert error">Not authorized.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Dynamic Form Builder</h1>
      <p className="lede">Create forms with tabs, sections, controls, validation, and layout.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="auth-form compact" onSubmit={(e) => void onCreateForm(e)}>
        <h2>New form</h2>
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
                onChange={(e) => setControlForm((f) => ({ ...f, sectionId: e.target.value }))}
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
                  onChange={(e) => setControlForm((f) => ({ ...f, fieldKey: e.target.value }))}
                />
              </label>
              <label>
                Label
                <input
                  required
                  value={controlForm.label}
                  onChange={(e) => setControlForm((f) => ({ ...f, label: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Type
              <select
                value={controlForm.controlType}
                onChange={(e) => setControlForm((f) => ({ ...f, controlType: e.target.value }))}
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
                      style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}
                    >
                      {section.controls.map((c) => (
                        <label key={c.id}>
                          {c.label}
                          {c.required ? ' *' : ''}
                          {c.controlType === 'TEXTAREA' ? (
                            <textarea
                              value={formValues[c.fieldKey] ?? ''}
                              onChange={(e) =>
                                setFormValues((v) => ({ ...v, [c.fieldKey]: e.target.value }))
                              }
                            />
                          ) : c.controlType === 'SELECT' ? (
                            <select
                              value={formValues[c.fieldKey] ?? ''}
                              onChange={(e) =>
                                setFormValues((v) => ({ ...v, [c.fieldKey]: e.target.value }))
                              }
                            >
                              <option value="">Select</option>
                              {(Array.isArray(c.options) ? c.options : []).map((opt, idx) => {
                                const o = opt as { label?: string; value?: string };
                                return (
                                  <option key={idx} value={o.value ?? ''}>
                                    {o.label ?? o.value}
                                  </option>
                                );
                              })}
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
                                setFormValues((v) => ({ ...v, [c.fieldKey]: e.target.value }))
                              }
                            />
                          )}
                        </label>
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
    </section>
  );
}
