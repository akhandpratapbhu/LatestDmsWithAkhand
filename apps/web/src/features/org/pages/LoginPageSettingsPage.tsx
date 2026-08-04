import { FormEvent, useEffect, useState } from 'react';
import type { LoginPageConfigDto } from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';

const empty: Omit<LoginPageConfigDto, 'id' | 'organizationId' | 'updatedAt'> = {
  companyName: '',
  welcomeText: 'Sign in to continue',
  description: null,
  logoUrl: null,
  backgroundUrl: null,
  theme: 'default',
  primaryColor: null,
  enablePasswordLogin: true,
  enableOtpLogin: false,
  enableTwoFactor: false,
  showRememberMe: true,
  footerText: null,
};

export function LoginPageSettingsPage() {
  const { currentOrg } = useOrg();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    void orgApi<LoginPageConfigDto>('/iam/login-page')
      .then((data) => {
        setForm({
          companyName: data.companyName,
          welcomeText: data.welcomeText,
          description: data.description,
          logoUrl: data.logoUrl,
          backgroundUrl: data.backgroundUrl,
          theme: data.theme,
          primaryColor: data.primaryColor,
          enablePasswordLogin: data.enablePasswordLogin,
          enableOtpLogin: data.enableOtpLogin,
          enableTwoFactor: data.enableTwoFactor,
          showRememberMe: data.showRememberMe,
          footerText: data.footerText,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load login page config'))
      .finally(() => setLoading(false));
  }, [currentOrg?.id]);

  const publicLoginPath = currentOrg
    ? `/${encodeURIComponent(currentOrg.slug)}/login`
    : null;
  const workspaceHomePath = currentOrg
    ? `/${encodeURIComponent(currentOrg.slug)}/dashboard`
    : null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await orgApi<LoginPageConfigDto>('/iam/login-page', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          welcomeText: form.welcomeText.trim(),
          description: form.description?.trim() || null,
          logoUrl: form.logoUrl?.trim() || null,
          backgroundUrl: form.backgroundUrl?.trim() || null,
          theme: form.theme.trim() || 'default',
          primaryColor: form.primaryColor?.trim() || null,
          enablePasswordLogin: form.enablePasswordLogin,
          enableOtpLogin: form.enableOtpLogin,
          enableTwoFactor: form.enableTwoFactor,
          showRememberMe: form.showRememberMe,
          footerText: form.footerText?.trim() || null,
        }),
      });
      setMessage('Login page settings saved to the project database.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <p className="muted">Select a project first.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Loading login page config…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Login page</h1>
      <p className="lede">
        Branding and auth options for this project. Stored in the project database
        {currentOrg.databaseName ? ` (${currentOrg.databaseName})` : ''}.
      </p>

      {publicLoginPath && (
        <p className="muted" style={{ marginTop: '-0.5rem' }}>
          Public login: <code>{publicLoginPath}</code>
          {workspaceHomePath ? (
            <>
              {' '}
              · After sign-in: <code>{workspaceHomePath}</code>
            </>
          ) : null}
          {currentOrg.subdomain ? (
            <>
              {' '}
              (also resolves by subdomain key <code>{currentOrg.subdomain}</code>)
            </>
          ) : null}
        </p>
      )}

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="row-actions" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
        {publicLoginPath && (
          <>
            <a
              className="btn"
              href={`${publicLoginPath}?preview=1`}
              target="_blank"
              rel="noreferrer"
            >
              Preview login page
            </a>
            <a className="btn" href={publicLoginPath} target="_blank" rel="noreferrer">
              Open public login
            </a>
          </>
        )}
      </div>

      <form className="auth-form compact" onSubmit={(e) => void onSave(e)}>
        <label>
          Company name
          <input
            value={form.companyName}
            onChange={(e) => setForm((s) => ({ ...s, companyName: e.target.value }))}
            maxLength={200}
          />
        </label>
        <label>
          Welcome text
          <input
            value={form.welcomeText}
            onChange={(e) => setForm((s) => ({ ...s, welcomeText: e.target.value }))}
            maxLength={500}
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value || null }))}
            maxLength={2000}
            rows={3}
            placeholder="Short blurb shown on the public login page"
          />
        </label>
        <label>
          Logo URL
          <input
            value={form.logoUrl ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, logoUrl: e.target.value || null }))}
          />
        </label>
        <label>
          Background URL
          <input
            value={form.backgroundUrl ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, backgroundUrl: e.target.value || null }))}
          />
        </label>
        <div className="row-2">
          <label>
            Theme
            <input
              value={form.theme}
              onChange={(e) => setForm((s) => ({ ...s, theme: e.target.value }))}
            />
          </label>
          <label>
            Primary color
            <input
              value={form.primaryColor ?? ''}
              onChange={(e) => setForm((s) => ({ ...s, primaryColor: e.target.value || null }))}
              placeholder="#0f766e"
            />
          </label>
        </div>
        <label>
          Footer text
          <input
            value={form.footerText ?? ''}
            onChange={(e) => setForm((s) => ({ ...s, footerText: e.target.value || null }))}
          />
        </label>

        <fieldset className="checkbox-stack">
          <legend>Auth methods</legend>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enablePasswordLogin}
              onChange={(e) => setForm((s) => ({ ...s, enablePasswordLogin: e.target.checked }))}
            />
            Password login
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enableOtpLogin}
              onChange={(e) => setForm((s) => ({ ...s, enableOtpLogin: e.target.checked }))}
            />
            OTP login
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.enableTwoFactor}
              onChange={(e) => setForm((s) => ({ ...s, enableTwoFactor: e.target.checked }))}
            />
            Two-factor authentication
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.showRememberMe}
              onChange={(e) => setForm((s) => ({ ...s, showRememberMe: e.target.checked }))}
            />
            Show “Remember me”
          </label>
        </fieldset>

        <button className="btn primary" type="submit">
          Save login page
        </button>
      </form>
    </section>
  );
}
