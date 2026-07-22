import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app" className="brand-mark compact">
          DMS
        </Link>
        <nav>
          <NavLink to="/app" end>
            Overview
          </NavLink>
          <NavLink to="/app/sessions">Sessions</NavLink>
        </nav>
        <div className="sidebar-foot">
          <p className="user-chip">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="btn ghost" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
