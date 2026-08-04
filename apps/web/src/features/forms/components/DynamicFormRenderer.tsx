import { FormEvent, useMemo } from 'react';

export type FormControlView = {
  id: string;
  fieldKey: string;
  label: string;
  controlType: string;
  required: boolean;
  placeholder: string | null;
  options: unknown;
};

export type FormSectionView = {
  id: string;
  name: string;
  columns: number;
  tabId: string | null;
  controls: FormControlView[];
};

export type FormTabView = {
  id: string;
  name: string;
  code: string;
};

export type DynamicFormDefinition = {
  id: string;
  name: string;
  tabs: FormTabView[];
  sections: FormSectionView[];
};

type Props = {
  form: DynamicFormDefinition;
  values: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitLabel?: string;
  disabled?: boolean;
  /** When true, fields are non-editable and the submit button is hidden. */
  readOnly?: boolean;
  hideSubmit?: boolean;
};

export function DynamicFormRenderer({
  form,
  values,
  onChange,
  onSubmit,
  submitLabel = 'Submit',
  disabled,
  readOnly,
  hideSubmit,
}: Props) {
  const sectionsByTab = useMemo(() => {
    if (!form.tabs.length) {
      return [{ tab: null as FormTabView | null, sections: form.sections }];
    }
    return form.tabs.map((tab) => ({
      tab,
      sections: form.sections.filter((s) => s.tabId === tab.id),
    }));
  }, [form]);

  const fieldsDisabled = Boolean(disabled || readOnly);

  return (
    <form className="auth-form compact" onSubmit={onSubmit}>
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
                        disabled={fieldsDisabled}
                        readOnly={readOnly}
                        value={values[c.fieldKey] ?? ''}
                        onChange={(e) => onChange(c.fieldKey, e.target.value)}
                      />
                    ) : c.controlType === 'SELECT' ? (
                      <select
                        disabled={fieldsDisabled}
                        value={values[c.fieldKey] ?? ''}
                        onChange={(e) => onChange(c.fieldKey, e.target.value)}
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
                        disabled={fieldsDisabled}
                        checked={values[c.fieldKey] === 'true'}
                        onChange={(e) => onChange(c.fieldKey, e.target.checked ? 'true' : 'false')}
                      />
                    ) : (
                      <input
                        disabled={fieldsDisabled}
                        readOnly={readOnly}
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
                        value={values[c.fieldKey] ?? ''}
                        onChange={(e) => onChange(c.fieldKey, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!readOnly && !hideSubmit && (
        <button className="btn primary" type="submit" disabled={disabled}>
          {submitLabel}
        </button>
      )}
    </form>
  );
}

/** Build empty string defaults for every control on a form definition. */
export function emptyFormValues(form: DynamicFormDefinition): Record<string, string> {
  const defaults: Record<string, string> = {};
  form.sections.forEach((s) =>
    s.controls.forEach((c) => {
      defaults[c.fieldKey] = '';
    }),
  );
  return defaults;
}

/** Flatten field keys/labels/types for grid columns (stable order). */
export function formFieldColumns(
  form: DynamicFormDefinition,
): Array<{ key: string; label: string; controlType: string }> {
  const seen = new Set<string>();
  const cols: Array<{ key: string; label: string; controlType: string }> = [];
  for (const section of form.sections) {
    for (const c of section.controls) {
      if (seen.has(c.fieldKey)) continue;
      seen.add(c.fieldKey);
      cols.push({ key: c.fieldKey, label: c.label, controlType: c.controlType });
    }
  }
  return cols;
}
