import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden={false}>
        <div className="auth-visual-brand">
          <Link to="/login" className="brand-mark compact">
            <span className="brand-badge">E</span>
            Enterprise Builder
          </Link>
        </div>
        <div>
          <h2>Build enterprise apps as projects.</h2>
          <p>
            Platform shell for projects, forms, grids, and IAM — metadata-driven today, multi-database
            ready tomorrow.
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
            <p className="brand-tagline">Sign in to Enterprise Builder</p>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
