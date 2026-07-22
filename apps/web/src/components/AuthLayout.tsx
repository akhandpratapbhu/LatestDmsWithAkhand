import { Outlet, Link } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-page">
      <div className="auth-backdrop" aria-hidden />
      <div className="auth-panel">
        <header className="auth-brand">
          <Link to="/login" className="brand-mark">
            DMS
          </Link>
          <p className="brand-tagline">Secure document workspace</p>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
