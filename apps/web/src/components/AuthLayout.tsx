import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden={false}>
        <div className="auth-visual-brand">
          <Link to="/login" className="brand-mark compact">
            <span className="brand-badge">C</span>
            Configure System
          </Link>
        </div>
        <div>
          <h2>Configure projects as systems.</h2>
          <p>
            Platform shell for projects, forms, grids, and IAM — metadata-driven setup with
            per-project databases.
          </p>
        </div>
        <div className="auth-visual-meta">
          <div>
            <strong>Projects</strong>
            Tenants with settings
          </div>
          <div>
            <strong>Builders</strong>
            Forms, grids & dashboards
          </div>
          <div>
            <strong>IAM</strong>
            Roles, menus & audit
          </div>
        </div>
      </aside>

      <div className="auth-panel-wrap">
        <div className="auth-panel">
          <header className="auth-brand">
            <p className="brand-tagline">Sign in to Configure System</p>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
