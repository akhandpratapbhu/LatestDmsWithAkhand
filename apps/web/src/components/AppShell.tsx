import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { useOrg } from '../features/org/org-context';
import { useIam } from '../features/iam/iam-context';

export function AppShell() {
  const { user, logout } = useAuth();
  const { organizations, currentOrg, selectOrg } = useOrg();
  const { sidebar, loading } = useIam();

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
          {loading && <p className="muted tiny">Loading menus…</p>}
          {!loading &&
            sidebar?.groups.map((group) => (
              <div key={group.id} className="nav-group">
                <p className="nav-group-label">{group.name}</p>
                {group.menus.map((menu) =>
                  menu.path ? (
                    <NavLink key={menu.id} to={menu.path} end={menu.path === '/app'}>
                      {menu.label}
                    </NavLink>
                  ) : null,
                )}
              </div>
            ))}
          {!loading && !sidebar?.groups.length && (
            <>
              <NavLink to="/app" end>
                Overview
              </NavLink>
              <NavLink to="/app/profile">Profile</NavLink>
            </>
          )}
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
