import type { SidebarMenuDto } from '@dms/shared';
import {
  DynamicFormDefinition,
  emptyFormValues,
} from './components/DynamicFormRenderer';

export type SubmissionRow = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  submittedBy: string | null;
};

export function resourceFromMenuPerm(code: string | undefined | null): string | null {
  if (!code?.startsWith('menu.')) return null;
  return code.slice('menu.'.length);
}

export function findMenuForForm(menus: SidebarMenuDto[], formId: string): SidebarMenuDto | null {
  const dataPath = `/app/data/${formId}`;
  for (const m of menus) {
    if (m.formId === formId || m.path === dataPath) return m;
    const child = findMenuForForm(m.children ?? [], formId);
    if (child) return child;
  }
  return null;
}

export function submissionToValues(
  form: DynamicFormDefinition,
  data: Record<string, unknown> | undefined,
): Record<string, string> {
  const values = emptyFormValues(form);
  if (!data) return values;
  for (const key of Object.keys(values)) {
    const raw = data[key];
    if (raw == null) continue;
    values[key] = typeof raw === 'string' ? raw : String(raw);
  }
  return values;
}

export function formRecordsGridPath(formId: string): string {
  return `/app/data/${formId}`;
}

export function formRecordNewPath(formId: string): string {
  return `/app/data/${formId}/new`;
}

export function formRecordViewPath(formId: string, submissionId: string): string {
  return `/app/data/${formId}/${submissionId}`;
}

export function formRecordEditPath(formId: string, submissionId: string): string {
  return `/app/data/${formId}/${submissionId}/edit`;
}
