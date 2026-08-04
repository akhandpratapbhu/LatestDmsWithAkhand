import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { MessageResponse, PublicProjectLoginDto } from '@dms/shared';
import { projectDashboardPath } from '@dms/shared';
import { api, setOrganizationId } from '../../../lib/api';
import { useAuth } from '../auth-context';

export function ProjectLoginPage() {
  const { projectSlug = '' } = useParams<{ projectSlug: string }>();
  const [searchParams] = useSearchParams();
  const previewOnly = searchParams.get('preview') === '1';
  const { login, loginWithOtp, user, bootstrapping } = useAuth();
  const navigate = useNavigate();

  const [payload, setPayload] = useState<PublicProjectLoginDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!projectSlug) return;
    setLoadingConfig(true);
    setLoadError(null);
    void api<PublicProjectLoginDto>(
      `/public/projects/${encodeURIComponent(projectSlug)}/login-page`,
      {},
      false,
    )
      .then((data) => {
        setPayload(data);
        if (data.config.enablePasswordLogin) setMode('password');
        else if (data.config.enableOtpLogin) setMode('otp');
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load login page'))
      .finally(() => setLoadingConfig(false));
  }, [projectSlug]);

  const brand = useMemo(() => {
    const config = payload?.config;
    const name = config?.companyName || payload?.project.name || 'Project';
    const initial = name.trim().charAt(0).toUpperCase() || 'P';
    return { name, initial, config };
  }, [payload]);

  const visualStyle = useMemo((): CSSProperties => {
    const primary = brand.config?.primaryColor || '#0f766e';
    const bg = brand.config?.backgroundUrl;
    const base: CSSProperties = {
      ['--project-primary' as string]: primary,
    };
    if (bg) {
      return {
        ...base,
        backgroundImage: `linear-gradient(155deg, color-mix(in srgb, ${primary} 50%, #0b1220) 0%, rgba(11, 18, 32, 0.82) 52%, rgba(11, 18, 32, 0.9) 100%), url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {
      ...base,
      background: `linear-gradient(150deg, color-mix(in srgb, ${primary} 38%, transparent) 0%, transparent 52%), linear-gradient(210deg, #0b1220 0%, #111827 58%, #0f172a 100%)`,
    };
  }, [brand.config?.backgroundUrl, brand.config?.primaryColor]);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (previewOnly) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, 'Web Browser');
      const slug = payload?.project.slug || projectSlug;
      if (payload?.project.id) setOrganizationId(payload.project.id);
      navigate(projectDashboardPath(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function onOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (previewOnly) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (!otpSent) {
        const res = await api<MessageResponse>(
          '/auth/otp/request',
          { method: 'POST', body: JSON.stringify({ email }) },
          false,
        );
        setInfo(res.message);
        setOtpSent(true);
      } else {
        await loginWithOtp(email, otp, 'Web Browser (OTP)');
        const slug = payload?.project.slug || projectSlug;
        if (payload?.project.id) setOrganizationId(payload.project.id);
        navigate(projectDashboardPath(slug));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (bootstrapping || loadingConfig) {
    return <div className="page-center muted">Loading login page…</div>;
  }

  if (loadError || !payload) {
    return (
      <div className="page-center">
        <div className="panel" style={{ maxWidth: 420 }}>
          <h1>Login unavailable</h1>
          <p className="lede">{loadError ?? 'Project not found.'}</p>
        </div>
      </div>
    );
  }

  const { config } = payload;
  const primaryBtnStyle = config.primaryColor
    ? ({ background: config.primaryColor, borderColor: config.primaryColor } as CSSProperties)
    : undefined;
  const description = config.description?.trim() || null;
  const welcome = config.welcomeText?.trim() || 'Sign in to continue';
  const badgeStyle = config.primaryColor ? { background: config.primaryColor } : undefined;

  return (
    <div className="project-login-page" style={visualStyle}>
      <div className="project-login-shell">
        <aside className="project-login-brand-pane" aria-label="Project branding">
          <div className="project-login-brand-stack">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="" className="project-login-logo hero" />
            ) : (
              <span className="project-login-mark" style={badgeStyle}>
                {brand.initial}
              </span>
            )}
            <p className="project-login-company">{brand.name}</p>
            <h1 className="project-login-welcome">{welcome}</h1>
            {description && <p className="project-login-description">{description}</p>}
          </div>
          {previewOnly && (
            <p className="project-login-preview-note">
              <strong>Preview</strong> — sign-in disabled
            </p>
          )}
        </aside>

        <div className="project-login-form-pane">
          <div className="project-login-form-card">
            <header className="project-login-form-header">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt={brand.name}
                  className="project-login-logo form"
                />
              ) : (
                <span className="project-login-mark form" style={badgeStyle}>
                  {brand.initial}
                </span>
              )}
              <div>
                <h2>{brand.name}</h2>
                <p>{welcome}</p>
              </div>
            </header>

            {description && <p className="project-login-form-desc">{description}</p>}

            {user && !previewOnly && (
              <div className="alert success" style={{ marginBottom: '0.85rem' }}>
                Signed in as {user.email}.{' '}
                <Link
                  to={projectDashboardPath(payload.project.slug || projectSlug)}
                  onClick={() => {
                    if (payload.project.id) setOrganizationId(payload.project.id);
                  }}
                >
                  Go to workspace
                </Link>
              </div>
            )}

            {previewOnly && (
              <div className="alert" style={{ marginBottom: '0.85rem' }}>
                Preview mode — form submit is disabled.
              </div>
            )}

            {error && <div className="alert error">{error}</div>}
            {info && <div className="alert success">{info}</div>}

            {config.enablePasswordLogin && config.enableOtpLogin && (
              <div className="project-login-mode-tabs" role="tablist" aria-label="Sign-in method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'password'}
                  className={mode === 'password' ? 'active' : undefined}
                  onClick={() => {
                    setMode('password');
                    setError(null);
                  }}
                >
                  Password
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'otp'}
                  className={mode === 'otp' ? 'active' : undefined}
                  onClick={() => {
                    setMode('otp');
                    setError(null);
                  }}
                >
                  OTP
                </button>
              </div>
            )}

            {mode === 'password' && config.enablePasswordLogin && (
              <form className="auth-form project-login-form" onSubmit={(e) => void onPasswordSubmit(e)}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={previewOnly}
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={previewOnly}
                  />
                </label>

                {config.showRememberMe && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={previewOnly}
                    />
                    Remember me
                  </label>
                )}

                <button
                  className="btn primary"
                  type="submit"
                  disabled={submitting || previewOnly}
                  style={primaryBtnStyle}
                >
                  {submitting ? 'Signing in…' : previewOnly ? 'Preview only' : 'Sign in'}
                </button>
              </form>
            )}

            {mode === 'otp' && config.enableOtpLogin && (
              <form className="auth-form project-login-form" onSubmit={(e) => void onOtpSubmit(e)}>
                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={otpSent || previewOnly}
                  />
                </label>

                {otpSent && (
                  <label>
                    OTP code
                    <input
                      inputMode="numeric"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={previewOnly}
                    />
                  </label>
                )}

                <button
                  className="btn primary"
                  type="submit"
                  disabled={submitting || previewOnly}
                  style={primaryBtnStyle}
                >
                  {previewOnly
                    ? 'Preview only'
                    : submitting
                      ? 'Please wait…'
                      : otpSent
                        ? 'Verify & sign in'
                        : 'Send OTP'}
                </button>
              </form>
            )}

            {!config.enablePasswordLogin && !config.enableOtpLogin && (
              <p className="muted">No sign-in methods are enabled for this project.</p>
            )}

            {config.footerText && <p className="project-login-footer muted">{config.footerText}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
