import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { ProjectStatus } from '@dms/shared';
import { suggestDatabaseName } from '@dms/shared';
import { useAuth } from '../../auth/auth-context';
import { useOrg, type CreateProjectInput } from '../org-context';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED', 'SUSPENDED'];
const THEMES = ['default', 'ocean', 'forest', 'slate', 'sunrise'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD'];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];
const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

type Step = 1 | 2 | 3;

export function CreateProjectPage() {
  const { user } = useAuth();
  const { createOrg } = useOrg();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dbNameTouched, setDbNameTouched] = useState(false);
  const [form, setForm] = useState<CreateProjectInput>({
    name: '',
    code: '',
    description: '',
    logoUrl: '',
    theme: 'default',
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
    subdomain: '',
    status: 'ACTIVE',
    version: '1.0.0',
    databaseName: '',
  });

  useEffect(() => {
    if (dbNameTouched) return;
    if (!form.name.trim()) {
      setForm((prev) => ({ ...prev, databaseName: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, databaseName: suggestDatabaseName(form.name) }));
  }, [form.name, dbNameTouched]);

  function setField<K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file');
      return;
    }
    if (file.size > 500_000) {
      setError('Logo file must be under 500KB (or paste an image URL instead)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setField('logoUrl', reader.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function validateStep1(): boolean {
    if (form.name.trim().length < 2) {
      setError('Project name is required (min 2 characters)');
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2(): boolean {
    const db = (form.databaseName ?? '').trim();
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(db)) {
      setError('Database name must be lowercase letters, digits, and underscores (start with a letter)');
      return false;
    }
    setError(null);
    return true;
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(3, s + 1) as Step);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) {
      setStep(1);
      return;
    }
    setError(null);
    setWarning(null);
    setSaving(true);
    try {
      const created = await createOrg({
        name: form.name.trim(),
        code: form.code?.trim() || undefined,
        description: form.description?.trim() || undefined,
        logoUrl: form.logoUrl?.trim() || undefined,
        theme: form.theme?.trim() || 'default',
        currency: form.currency?.trim() || 'USD',
        language: form.language?.trim() || 'en',
        timezone: form.timezone?.trim() || 'UTC',
        subdomain: form.subdomain?.trim() || undefined,
        status: form.status ?? 'ACTIVE',
        version: form.version?.trim() || '1.0.0',
        databaseName: form.databaseName?.trim(),
      });
      if (created.provisioningWarning) {
        setWarning(created.provisioningWarning);
        // Brief pause so the warning is visible, then go to dashboard
        setTimeout(() => navigate('/app/projects'), 2500);
      } else {
        navigate('/app/projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  if (!user?.isPlatformAdmin) {
    return <Navigate to="/app/projects" replace />;
  }

  return (
    <section className="panel">
      <p className="muted tiny">
        <Link to="/app/projects">← Projects</Link>
      </p>
      <h1>Add Project</h1>
      <p className="lede">
        Create a project (tenant). We save platform metadata, try to provision a Postgres database,
        and seed IAM for you as project admin.
      </p>

      <ol className="wizard-steps" aria-label="Wizard steps">
        <li className={step === 1 ? 'active' : step > 1 ? 'done' : ''}>1. Basic</li>
        <li className={step === 2 ? 'active' : step > 2 ? 'done' : ''}>2. Database</li>
        <li className={step === 3 ? 'active' : ''}>3. Review</li>
      </ol>

      {error && <div className="alert error">{error}</div>}
      {warning && <div className="alert">{warning}</div>}

      <form className="auth-form compact" onSubmit={(e) => void onSubmit(e)}>
        {step === 1 && (
          <>
            <label>
              Project name
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Hospital Management"
                autoFocus
              />
            </label>

            <div className="row-2">
              <label>
                Code
                <input
                  value={form.code ?? ''}
                  onChange={(e) => setField('code', e.target.value)}
                  maxLength={40}
                  placeholder="HOSP"
                />
              </label>
              <label>
                Version
                <input
                  value={form.version ?? '1.0.0'}
                  onChange={(e) => setField('version', e.target.value)}
                  maxLength={32}
                />
              </label>
            </div>

            <label>
              Description
              <textarea
                value={form.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="What is this project for?"
              />
            </label>

            <label>
              Logo URL
              <input
                value={form.logoUrl ?? ''}
                onChange={(e) => setField('logoUrl', e.target.value)}
                maxLength={2000}
                placeholder="https://… or upload below"
              />
            </label>
            <label>
              Or upload logo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {form.logoUrl ? (
              <div className="project-logo-preview">
                <img src={form.logoUrl} alt="Logo preview" />
              </div>
            ) : null}

            <div className="row-2">
              <label>
                Theme
                <select
                  value={form.theme ?? 'default'}
                  onChange={(e) => setField('theme', e.target.value)}
                >
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status ?? 'ACTIVE'}
                  onChange={(e) => setField('status', e.target.value as ProjectStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="row-2">
              <label>
                Timezone
                <select
                  value={form.timezone ?? 'UTC'}
                  onChange={(e) => setField('timezone', e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Currency
                <select
                  value={form.currency ?? 'USD'}
                  onChange={(e) => setField('currency', e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="row-2">
              <label>
                Language
                <select
                  value={form.language ?? 'en'}
                  onChange={(e) => setField('language', e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subdomain (optional)
                <input
                  value={form.subdomain ?? ''}
                  onChange={(e) => setField('subdomain', e.target.value.toLowerCase())}
                  maxLength={63}
                  pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                  placeholder="hospital"
                />
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted">
              Auto-generated from the project name. Override if you need a specific Postgres
              database name. On create we attempt <code>CREATE DATABASE</code> on the same server
              as <code>DATABASE_URL</code>.
            </p>
            <label>
              Database name
              <input
                value={form.databaseName ?? ''}
                onChange={(e) => {
                  setDbNameTouched(true);
                  setField(
                    'databaseName',
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  );
                }}
                required
                maxLength={63}
                pattern="[a-z][a-z0-9_]{0,62}"
                placeholder="hospital_management_db"
              />
            </label>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setDbNameTouched(false);
                setField('databaseName', suggestDatabaseName(form.name));
              }}
            >
              Reset from project name
            </button>
          </>
        )}

        {step === 3 && (
          <div className="wizard-review">
            <h2>Review</h2>
            <dl className="review-dl">
              <div>
                <dt>Name</dt>
                <dd>{form.name}</dd>
              </div>
              <div>
                <dt>Code</dt>
                <dd>{form.code || '—'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{form.description || '—'}</dd>
              </div>
              <div>
                <dt>Theme / Locale</dt>
                <dd>
                  {form.theme} · {form.timezone} · {form.currency} · {form.language}
                </dd>
              </div>
              <div>
                <dt>Database</dt>
                <dd>
                  <code>{form.databaseName}</code>
                </dd>
              </div>
              <div>
                <dt>Version / Status</dt>
                <dd>
                  v{form.version} · {form.status}
                </dd>
              </div>
            </dl>
            <p className="muted tiny">
              You will be project admin. IAM roles and menus are seeded automatically. If database
              creation fails (permissions), the project is still created with a warning.
            </p>
          </div>
        )}

        <div className="action-row">
          {step > 1 ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              disabled={saving}
            >
              Back
            </button>
          ) : (
            <Link className="btn ghost" to="/app/projects">
              Cancel
            </Link>
          )}
          {step < 3 ? (
            <button type="button" className="btn primary" onClick={goNext}>
              Next
            </button>
          ) : (
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
