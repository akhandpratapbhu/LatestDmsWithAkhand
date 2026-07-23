import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../features/auth/auth-context';
import { useOrg } from '../features/org/org-context';
import { useIam } from '../features/iam/iam-context';
import { api, getAccessToken } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { SearchModal } from './SearchModal';

const HIDDEN_SIDEBAR_PATHS = new Set(['/app/notifications', '/app/profile', '/app/search']);
const SIDEBAR_OPEN_KEY = 'dms_sidebar_open_groups';

function titleFromPath(pathname: string): string {
  if (pathname === '/app' || pathname === '/app/') return 'Overview';
  const last = pathname.split('/').filter(Boolean).pop() ?? 'Workspace';
  return last
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function loadOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { organizations, currentOrg, selectOrg } = useOrg();
  const { sidebar, loading } = useIam();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = useMemo(() => titleFromPath(location.pathname), [location.pathname]);

  const visibleGroups = useMemo(() => {
    if (!sidebar?.groups) return [];
    return sidebar.groups
      .map((group) => ({
        ...group,
        menus: group.menus.filter((menu) => menu.path && !HIDDEN_SIDEBAR_PATHS.has(menu.path)),
      }))
      .filter((group) => group.menus.length > 0);
  }, [sidebar?.groups]);

  useEffect(() => {
    // Keep the group containing the active route expanded
    const activeGroup = visibleGroups.find((group) =>
      group.menus.some((menu) => {
        if (!menu.path) return false;
        if (menu.path === '/app') return location.pathname === '/app' || location.pathname === '/app/';
        return location.pathname === menu.path || location.pathname.startsWith(`${menu.path}/`);
      }),
    );
    if (!activeGroup) return;
    setOpenGroups((prev) => {
      if (prev[activeGroup.id] === true) return prev;
      const next = { ...prev, [activeGroup.id]: true };
      localStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }, [location.pathname, visibleGroups]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !(prev[groupId] ?? true) };
      localStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }

  function isGroupOpen(groupId: string) {
    return openGroups[groupId] ?? true;
  }

  useEffect(() => {
    void api<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count))
      .catch(() => undefined);

    const token = getAccessToken();
    if (!token) return;
    const socket = io(`${window.location.origin}/notifications`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('notification', () => setUnread((c) => c + 1));
    return () => {
      socket.disconnect();
    };
  }, [user?.id, currentOrg?.id]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function onLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/app" className="brand-mark compact">
            <span className="brand-badge">D</span>
            DMS
          </Link>
          <span className="sidebar-env">Local</span>
        </div>

        <nav>
          {loading && <p className="muted tiny">Loading menus…</p>}
          {!loading &&
            visibleGroups.map((group) => {
              const open = isGroupOpen(group.id);
              return (
                <div key={group.id} className={`nav-group ${open ? 'open' : 'collapsed'}`}>
                  <button
                    type="button"
                    className="nav-group-toggle"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span>{group.name}</span>
                    <svg
                      className="nav-group-caret"
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M5 7.5 10 12.5 15 7.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {open && (
                    <div className="nav-group-items">
                      {group.menus.map((menu) => (
                        <NavLink key={menu.id} to={menu.path!} end={menu.path === '/app'}>
                          <span>{menu.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          {!loading && !visibleGroups.length && (
            <NavLink to="/app" end>
              Overview
            </NavLink>
          )}
        </nav>
      </aside>

      <header className="app-header">
        <div className="app-header-left">
          <div className="app-header-crumb">
            <span>{currentOrg?.name || 'Workspace'}</span>
            <span aria-hidden>/</span>
            <strong>{pageTitle}</strong>
          </div>
        </div>
        <div className="app-header-right">
          <button
            type="button"
            className="header-search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search"
            title="Search (⌘K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>Search workspace…</span>
            <kbd>⌘K</kbd>
          </button>

          {organizations.length > 0 && (
            <select
              className="header-org"
              value={currentOrg?.id ?? ''}
              onChange={(e) => selectOrg(e.target.value)}
              aria-label="Organization"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="header-icon-btn header-search-icon"
            aria-label="Open search"
            title="Search"
            onClick={() => setSearchOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <Link
            to="/app/notifications"
            className="header-icon-btn"
            aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
            title="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22Zm7-5.5V11a7 7 0 1 0-14 0v5.5L3 18.5V20h18v-1.5L19 16.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            {unread > 0 ? <span className="header-badge">{unread > 99 ? '99+' : unread}</span> : null}
          </Link>

          <div className="header-menu" ref={menuRef}>
            <button
              type="button"
              className="header-user-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <UserAvatar
                firstName={user?.firstName}
                lastName={user?.lastName}
                avatarUrl={user?.avatarUrl}
                size="sm"
              />
              <div className="header-user-meta">
                <span>
                  {user?.firstName} {user?.lastName}
                </span>
                <small>{user?.email}</small>
              </div>
              <svg className="header-caret" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {menuOpen && (
              <div className="header-dropdown" role="menu">
                <div className="header-dropdown-head">
                  <UserAvatar
                    firstName={user?.firstName}
                    lastName={user?.lastName}
                    avatarUrl={user?.avatarUrl}
                    size="md"
                  />
                  <div>
                    <strong>
                      {user?.firstName} {user?.lastName}
                    </strong>
                    <span>{user?.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/app/profile');
                  }}
                >
                  Profile
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => void onLogout()}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
