import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden={false}>
        <div className="auth-visual-brand">
          <Link to="/login" className="brand-mark compact">
            <span className="brand-badge">D</span>
            DMS
          </Link>
        </div>
        <div>
          <h2>Enterprise document operations, organized.</h2>
          <p>
            Secure access, role-based workspaces, and audit-ready workflows for teams that run on
            documents.
          </p>
        </div>
        <div className="auth-visual-meta">
          <div>
            <strong>SSO-ready</strong>
            Auth, OTP & sessions
          </div>
          <div>
            <strong>Audit trail</strong>
            Every critical action
          </div>
          <div>
            <strong>Masters</strong>
            Customers to warehouses
          </div>
        </div>
      </aside>

      <div className="auth-panel-wrap">
        <div className="auth-panel">
          <header className="auth-brand">
            <p className="brand-tagline">Sign in to continue to DMS</p>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
