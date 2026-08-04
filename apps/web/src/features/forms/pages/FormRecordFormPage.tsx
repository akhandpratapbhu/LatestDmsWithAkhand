import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { PageHeader } from '../../../components/PageHeader';
import {
  DynamicFormDefinition,
  DynamicFormRenderer,
  emptyFormValues,
} from '../components/DynamicFormRenderer';
import {
  findMenuForForm,
  formRecordsGridPath,
  resourceFromMenuPerm,
  SubmissionRow,
  submissionToValues,
} from '../form-records-utils';

export type FormRecordFormMode = 'create' | 'edit' | 'view';

type Props = {
  mode: FormRecordFormMode;
};

export function FormRecordFormPage({ mode }: Props) {
  const { formId = '', submissionId = '' } = useParams<{
    formId: string;
    submissionId?: string;
  }>();
  const { currentOrg } = useOrg();
  const { hasPermission, sidebar } = useIam();
  const hrefFor = useWorkspaceHref();
  const navigate = useNavigate();

  const [form, setForm] = useState<DynamicFormDefinition | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const resource = useMemo(() => {
    if (!formId || !sidebar?.groups) return null;
    for (const g of sidebar.groups) {
      const menu = findMenuForForm(g.menus, formId);
      if (menu) return resourceFromMenuPerm(menu.permissionCode);
    }
    return null;
  }, [sidebar, formId]);

  const canView = Boolean(
    resource &&
      (hasPermission(`${resource}.view`) ||
        hasPermission(`menu.${resource}`) ||
        hasPermission(`screen.${resource}`)),
  );
  const legacyWrite = resource
    ? hasPermission(`api.${resource}.write`) &&
      !hasPermission(`${resource}.create`) &&
      !hasPermission(`${resource}.update`) &&
      !hasPermission(`${resource}.delete`)
    : false;
  const canCreate = Boolean(resource && (hasPermission(`${resource}.create`) || legacyWrite));
  const canUpdate = Boolean(resource && (hasPermission(`${resource}.update`) || legacyWrite));

  const allowed =
    mode === 'create' ? canCreate : mode === 'edit' ? canUpdate : canView || canUpdate;

  const gridHref = hrefFor(formRecordsGridPath(formId));

  const goToGrid = useCallback(() => {
    navigate(gridHref);
  }, [navigate, gridHref]);

  const load = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await orgApi<DynamicFormDefinition>(`/forms/${formId}`);
      setForm(detail);

      if (mode === 'create') {
        setValues(emptyFormValues(detail));
        return;
      }

      if (!submissionId) {
        setError('Missing record id');
        return;
      }

      const row = await orgApi<SubmissionRow>(`/forms/${formId}/submissions/${submissionId}`);
      setValues(submissionToValues(detail, row.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [formId, submissionId, mode]);

  useEffect(() => {
    if (!currentOrg || !formId) return;
    void load();
  }, [currentOrg?.id, formId, load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formId || saving) return;

    if (mode === 'create') {
      if (!canCreate) return;
      setSaving(true);
      setError(null);
      try {
        await orgApi(`/forms/${formId}/submit`, {
          method: 'POST',
          body: JSON.stringify({ data: values }),
        });
        navigate(gridHref);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'edit') {
      if (!canUpdate || !submissionId) return;
      setSaving(true);
      setError(null);
      try {
        await orgApi(`/forms/${formId}/submissions/${submissionId}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: values }),
        });
        navigate(gridHref);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setSaving(false);
      }
    }
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Record</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  const title =
    mode === 'create'
      ? `New ${form?.name ?? 'record'}`
      : mode === 'edit'
        ? `Edit ${form?.name ?? 'record'}`
        : form?.name ?? 'View record';

  const description =
    mode === 'create'
      ? 'Fill in the fields and save to create a record.'
      : mode === 'edit'
        ? 'Update the fields and save your changes.'
        : 'Read-only details for this submission.';

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <button type="button" className="btn ghost" onClick={goToGrid}>
            {mode === 'view' ? 'Back' : 'Cancel'}
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      {!allowed && !loading && (
        <div className="alert error">You do not have permission for this action.</div>
      )}

      {loading && <p className="muted">Loading…</p>}

      {!loading && form && allowed && (
        <section className="section-card">
          <div className="section-card-body">
            <DynamicFormRenderer
              form={form}
              values={values}
              onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
              onSubmit={(e) => {
                if (mode === 'view') {
                  e.preventDefault();
                  return;
                }
                void onSubmit(e);
              }}
              submitLabel={saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
              disabled={saving}
              readOnly={mode === 'view'}
            />
          </div>
        </section>
      )}
    </div>
  );
}
