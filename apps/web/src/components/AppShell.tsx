import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  isMenuPathAllowedForFeatures,
  resolveAppHref,
  toCanonicalAppPath,
  type SidebarMenuDto,
} from '@dms/shared';
import { useAuth } from '../features/auth/auth-context';
import { useOrg } from '../features/org/org-context';
import { useIam } from '../features/iam/iam-context';
import { api, getAccessToken } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { SearchModal } from './SearchModal';

const HIDDEN_SIDEBAR_PATHS = new Set(['/app/notifications', '/app/profile', '/app/search']);
const SIDEBAR_OPEN_KEY = 'dms_sidebar_open_groups';

function titleFromPath(pathname: string, projectSlug?: string | null): string {
  const canonical = toCanonicalAppPath(pathname, projectSlug);
  if (canonical === '/app' || canonical === '/app/') return 'Overview';
  if (canonical.startsWith('/app/projects')) return 'Project Dashboard';
  if (canonical.startsWith('/app/features')) return 'Features';
  if (canonical.startsWith('/app/settings/login')) return 'Login page';
  if (canonical.startsWith('/app/menus')) return 'Menus';
  if (canonical.startsWith('/app/data/')) return 'Form records';
  const last = canonical.split('/').filter(Boolean).pop() ?? 'Workspace';
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

function menuMatchesPath(
  menu: SidebarMenuDto,
  pathname: string,
  hrefFor: (appPath: string) => string,
): boolean {
  if (menu.path) {
    const href = hrefFor(menu.path);
    if (menu.path === '/app') {
      if (pathname === href || pathname === `${href}/`) return true;
    } else if (pathname === href || pathname.startsWith(`${href}/`)) {
      return true;
    }
  }
  return (menu.children ?? []).some((child) => menuMatchesPath(child, pathname, hrefFor));
}

function filterMenusForFeatures(
  menus: SidebarMenuDto[],
  enabledFeatures: string[],
): SidebarMenuDto[] {
  return menus
    .map((menu) => {
      const children = filterMenusForFeatures(menu.children ?? [], enabledFeatures);
      const pathOk =
        !!menu.path &&
        !HIDDEN_SIDEBAR_PATHS.has(menu.path) &&
        isMenuPathAllowedForFeatures(menu.path, enabledFeatures);
      if (pathOk || children.length > 0) {
        return { ...menu, children };
      }
      return null;
    })
    .filter(Boolean) as SidebarMenuDto[];
}

function SidebarMenuLinks({
  menus,
  hrefFor,
}: {
  menus: SidebarMenuDto[];
  hrefFor: (appPath: string) => string;
}) {
  return (
    <>
      {menus.map((menu) => {
        const hasChildren = (menu.children?.length ?? 0) > 0;
        if (hasChildren) {
          return (
            <div key={menu.id} className="nav-submenu">
              {menu.path ? (
                <NavLink to={hrefFor(menu.path)} end={menu.path === '/app'} className="nav-parent-link">
                  <span>{menu.label}</span>
                </NavLink>
              ) : (
                <div className="nav-parent-label">{menu.label}</div>
              )}
              <div className="nav-submenu-items">
                <SidebarMenuLinks menus={menu.children} hrefFor={hrefFor} />
              </div>
            </div>
          );
        }
        if (!menu.path) return null;
        return (
          <NavLink key={menu.id} to={hrefFor(menu.path)} end={menu.path === '/app'}>
            <span>{menu.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { organizations, currentOrg, selectOrg } = useOrg();
  const { sidebar, loading } = useIam();
  const { projectSlug: routeSlug } = useParams<{ projectSlug?: string }>();
  const projectSlug = routeSlug?.trim() || currentOrg?.slug?.trim() || null;
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = useMemo(
    () => titleFromPath(location.pathname, routeSlug),
    [location.pathname, routeSlug],
  );

  const hrefFor = useMemo(
    () => (appPath: string) => resolveAppHref(appPath, projectSlug),
    [projectSlug],
  );

  const enabledFeatures = currentOrg?.enabledFeatures ?? [];

  const visibleGroups = useMemo(() => {
    if (!sidebar?.groups) return [];
    return sidebar.groups
      .map((group) => ({
        ...group,
        menus: filterMenusForFeatures(group.menus, enabledFeatures),
      }))
      .filter((group) => group.menus.length > 0);
  }, [sidebar?.groups, enabledFeatures]);

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) =>
      !group.isOuter &&
      group.code !== '_OUTER' &&
      group.menus.some((menu) => menuMatchesPath(menu, location.pathname, hrefFor)),
    );
    if (!activeGroup) return;
    setOpenGroups((prev) => {
      if (prev[activeGroup.id] === true) return prev;
      const next = { ...prev, [activeGroup.id]: true };
      localStorage.setItem(SIDEBAR_OPEN_KEY, JSON.stringify(next));
      return next;
    });
  }, [location.pathname, visibleGroups, hrefFor]);

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
    navigate(routeSlug ? `/${encodeURIComponent(routeSlug)}/login` : '/login');
  }

  function onSwitchProject(id: string) {
    const org = organizations.find((o) => o.id === id);
    selectOrg(id);
    if (!org?.slug) return;
    if (routeSlug) {
      const canonical = toCanonicalAppPath(location.pathname, routeSlug);
      navigate(resolveAppHref(canonical, org.slug));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/app/projects" className="brand-mark compact">
            <span className="brand-badge">E</span>
            Enterprise Builder
          </Link>
          <span className="sidebar-env">Local</span>
        </div>

        <nav>
          {loading && <p className="muted tiny">Loading menus…</p>}
          {!loading &&
            visibleGroups.map((group) => {
              if (group.isOuter || group.code === '_OUTER') {
                return (
                  <div key={group.id} className="nav-group outer">
                    <div className="nav-group-items">
                      <SidebarMenuLinks menus={group.menus} hrefFor={hrefFor} />
                    </div>
                  </div>
                );
              }
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
                      <SidebarMenuLinks menus={group.menus} hrefFor={hrefFor} />
                    </div>
                  )}
                </div>
              );
            })}
          {!loading && !visibleGroups.length && (
            <NavLink to={hrefFor('/app')} end>
              Dashboard
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
            <span>Search platform…</span>
            <kbd>⌘K</kbd>
          </button>

          {organizations.length > 0 && (
            <label className="header-project-switcher">
              <span className="header-project-label">Project</span>
              <select
                className="header-org"
                value={currentOrg?.id ?? ''}
                onChange={(e) => onSwitchProject(e.target.value)}
                aria-label="Switch project"
                title="Switch project"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
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
            to={hrefFor('/app/notifications')}
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
                    navigate(hrefFor('/app/profile'));
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
