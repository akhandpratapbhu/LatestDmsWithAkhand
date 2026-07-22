import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { useOrg } from '../features/org/org-context';

export function AppShell() {
  const { user, logout } = useAuth();
  const { organizations, currentOrg, selectOrg } = useOrg();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app" className="brand-mark compact">
          DMS
        </Link>
        {organizations.length > 0 && (
          <select
            className="org-select"
            value={currentOrg?.id ?? ''}
            onChange={(e) => selectOrg(e.target.value)}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <nav>
          <NavLink to="/app" end>
            Overview
          </NavLink>
          <NavLink to="/app/organization">Organization</NavLink>
          <NavLink to="/app/users">Users</NavLink>
          <NavLink to="/app/profile">Profile</NavLink>
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
