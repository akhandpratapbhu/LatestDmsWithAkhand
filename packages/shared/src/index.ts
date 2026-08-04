export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorBody = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  path?: string;
  timestamp: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  /** Platform-wide: can create projects. */
  isPlatformAdmin: boolean;
  /** Home/primary organization; null for platform admins / multi-org / self-register. */
  organizationId: string | null;
  status: UserAccountStatus;
  createdAt: string;
};

export type SessionInfo = {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
};

export type LoginResponse = {
  user: AuthUser;
  tokens: AuthTokens;
  session: SessionInfo;
};

export type MessageResponse = {
  message: string;
};

export type ForgotPasswordResetTokenResponse = {
  message: string;
  resetToken: string;
};

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';
export type UserAccountStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';

/** Project lifecycle status (Organization = Project in product UX). */
export type ProjectStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'SUSPENDED';

/**
 * Organization row in the API / DB.
 * Product name: **Project** (Enterprise Builder).
 */
export type OrganizationDto = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  description: string | null;
  logoUrl: string | null;
  version: string;
  databaseName: string | null;
  isActive: boolean;
  status: ProjectStatus;
  theme: string;
  currency: string;
  language: string;
  timezone: string;
  subdomain: string | null;
  /** Set when CREATE DATABASE succeeds (plain in local/dev). */
  connectionString: string | null;
  /** Installed platform feature keys. */
  enabledFeatures: string[];
  ownerId: string;
  /** Present on list/mine responses: caller's membership role in this project. */
  membershipRole?: OrgRole;
  createdAt: string;
  updatedAt: string;
  /** Present on create when DB provisioning failed but project metadata was saved. */
  provisioningWarning?: string;
  /** Present on create: true when CREATE DATABASE succeeded. */
  databaseProvisioned?: boolean;
};

/** Alias for product-facing Project terminology. */
export type ProjectDto = OrganizationDto;

/** Project-DB login page branding / auth options. */
export type LoginPageConfigDto = {
  id: string;
  organizationId: string;
  companyName: string;
  welcomeText: string;
  description: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  theme: string;
  primaryColor: string | null;
  enablePasswordLogin: boolean;
  enableOtpLogin: boolean;
  enableTwoFactor: boolean;
  showRememberMe: boolean;
  footerText: string | null;
  updatedAt: string;
};

/** Public branded login payload for `/:projectSlug/login`. */
export type PublicProjectLoginDto = {
  project: {
    id: string;
    name: string;
    slug: string;
    code: string | null;
    subdomain: string | null;
  };
  config: Omit<LoginPageConfigDto, 'id' | 'organizationId' | 'updatedAt'>;
};

/** Static platform feature catalog entry (marketplace). */
export type PlatformFeatureCatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  /** App routes whose sidebar entries are shown when this feature is installed. */
  menuPaths: string[];
  /** True when the engine is stubbed / coming soon. */
  comingSoon?: boolean;
};

export type BranchDto = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
};

export type DepartmentDto = {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
};

export type DesignationDto = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  level: number;
  isActive: boolean;
  createdAt: string;
};

export type TeamDto = {
  id: string;
  organizationId: string;
  branchId: string | null;
  departmentId: string | null;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
};

export type CostCenterDto = {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

export type MembershipDto = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  status: MembershipStatus;
  branchId: string | null;
  departmentId: string | null;
  designationId: string | null;
  teamId: string | null;
  costCenterId: string | null;
  joinedAt: string;
  user?: AuthUser;
  organization?: OrganizationDto;
};

export type PasswordPolicyDto = {
  id: string;
  organizationId: string;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  passwordHistory: number;
  maxAgeDays: number | null;
};

export type OrgUserDto = {
  membershipId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  /** Home/primary organization on the user row (may differ from list org for multi-org). */
  organizationId: string | null;
  role: OrgRole;
  status: MembershipStatus;
  accountStatus: UserAccountStatus;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branchId: string | null;
  departmentId: string | null;
  designationId: string | null;
  teamId: string | null;
  costCenterId: string | null;
  joinedAt: string;
};

export type PermissionType = 'SCREEN' | 'API' | 'DATA' | 'MENU';
export type WidgetType = 'CHART' | 'CARD' | 'TABLE' | 'TEXT';

export type SidebarMenuDto = {
  id: string;
  label: string;
  path: string | null;
  icon: string | null;
  formId?: string | null;
  /** Linked IAM menu permission code, e.g. `menu.hospitals`. */
  permissionCode?: string | null;
  sortOrder: number;
  children: SidebarMenuDto[];
};

export type SidebarGroupDto = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  /** When true, menus render as outer top-level items (no group toggle). */
  isOuter?: boolean;
  menus: SidebarMenuDto[];
};

export type SidebarResponse = {
  groups: SidebarGroupDto[];
  permissions: string[];
  landingPath: string;
};

export type DashboardWidgetDto = {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
  sortOrder: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
};

export type DashboardDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roleId: string | null;
  isDefault: boolean;
  isLanding: boolean;
  widgets: DashboardWidgetDto[];
};

/** Platform shell paths that stay visible regardless of installed features. */
export const PLATFORM_SHELL_PATHS = ['/app/projects', '/app/features'] as const;

/** Default features installed when a new project is created. */
export const DEFAULT_ENABLED_FEATURES: string[] = [
  'dashboard',
  'users',
  'roles',
  'forms',
  'grids',
  'reports',
  'chat',
  'notifications',
  'audit',
  'activity',
  'sessions',
  'calls',
  'login-page',
  'menu-builder',
];

/** Static marketplace catalog (Phase 1 — not yet DB-backed plugins). */
export const PLATFORM_FEATURE_CATALOG: PlatformFeatureCatalogItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Project overview landing page and widgets.',
    category: 'Core',
    menuPaths: ['/app'],
  },
  {
    id: 'users',
    name: 'Users',
    description: 'Invite and manage project members.',
    category: 'Access',
    menuPaths: ['/app/users'],
  },
  {
    id: 'roles',
    name: 'Identity & Access',
    description: 'Roles, permissions, and menu access control.',
    category: 'Access',
    menuPaths: ['/app/iam'],
  },
  {
    id: 'forms',
    name: 'Forms',
    description: 'Metadata-driven form builder.',
    category: 'Builders',
    menuPaths: ['/app/forms'],
  },
  {
    id: 'grids',
    name: 'Grids',
    description: 'Metadata-driven data grids.',
    category: 'Builders',
    menuPaths: ['/app/grids'],
  },
  {
    id: 'workflow',
    name: 'Workflow',
    description: 'Approval and process workflows.',
    category: 'Builders',
    menuPaths: [],
    comingSoon: true,
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Dashboards and report widgets.',
    category: 'Builders',
    menuPaths: ['/app/dashboards'],
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Project team messaging.',
    category: 'Workspace',
    menuPaths: ['/app/chat'],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'In-app notification center.',
    category: 'Workspace',
    menuPaths: ['/app/notifications'],
  },
  {
    id: 'audit',
    name: 'Audit',
    description: 'Compliance and change audit trail.',
    category: 'Governance',
    menuPaths: ['/app/audit'],
  },
  {
    id: 'theme',
    name: 'Theme',
    description: 'Project theme and branding controls.',
    category: 'Configuration',
    menuPaths: [],
    comingSoon: true,
  },
  {
    id: 'menu-builder',
    name: 'Menu Builder',
    description: 'Customize project navigation menus and link them to dynamic forms.',
    category: 'Configuration',
    menuPaths: ['/app/menus'],
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Master data browser (removed from sidebar; API retained for chat directory).',
    category: 'Configuration',
    menuPaths: [],
    comingSoon: true,
  },
  {
    id: 'activity',
    name: 'Activity',
    description: 'Recent activity feed.',
    category: 'Workspace',
    menuPaths: ['/app/activity'],
  },
  {
    id: 'sessions',
    name: 'Sessions',
    description: 'Active session management.',
    category: 'Access',
    menuPaths: ['/app/sessions'],
  },
  {
    id: 'calls',
    name: 'Calls',
    description: 'Call history and sessions.',
    category: 'Workspace',
    menuPaths: ['/app/calls'],
  },
  {
    id: 'login-page',
    name: 'Login page',
    description: 'Project login branding and auth method flags (stored in project DB).',
    category: 'Configuration',
    menuPaths: ['/app/settings/login'],
  },
];

/** Paths allowed in the sidebar for a given enabledFeatures list. */
export function menuPathsForFeatures(enabledFeatures: string[]): Set<string> {
  const allowed = new Set<string>(PLATFORM_SHELL_PATHS);
  for (const feature of PLATFORM_FEATURE_CATALOG) {
    if (!enabledFeatures.includes(feature.id)) continue;
    for (const path of feature.menuPaths) allowed.add(path);
  }
  return allowed;
}

/**
 * Whether a sidebar menu path is allowed for the installed features.
 * Exact catalog paths plus runtime prefixes (e.g. form-linked `/app/data/:formId`).
 */
export function isMenuPathAllowedForFeatures(
  path: string | null | undefined,
  enabledFeatures: string[],
): boolean {
  if (!path) return false;
  const exact = menuPathsForFeatures(enabledFeatures);
  if (exact.has(path)) return true;
  if (path.startsWith('/app/data/') && enabledFeatures.includes('forms')) return true;
  return false;
}

/** Canonical path for a form-linked sidebar menu. */
export function formDataAppPath(formId: string): string {
  return `/app/data/${formId}`;
}

/**
 * Top-level path segments that must not be used as project public-login slugs
 * (avoids clashes with `/:projectSlug/login`, e.g. `/app/login`).
 */
export const RESERVED_PROJECT_SLUGS = new Set([
  'app',
  'api',
  'auth',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'otp-login',
  'accept-invite',
  'p',
  'public',
  'assets',
  'static',
  'health',
]);

/**
 * Canonical IAM / catalog paths that stay under `/app` (platform shell),
 * even when the user is inside a project workspace.
 */
export function isPlatformOnlyAppPath(appPath: string): boolean {
  return appPath === '/app/projects' || appPath.startsWith('/app/projects/');
}

/**
 * Map a canonical `/app/...` path (menus, catalog, API links) to the browser URL.
 * - Platform-only paths stay under `/app/...`
 * - Dashboard `/app` → `/{slug}/dashboard`
 * - Other workspace paths → `/{slug}/...` when a project slug is available
 */
export function resolveAppHref(appPath: string, projectSlug?: string | null): string {
  if (!appPath) return appPath;
  if (isPlatformOnlyAppPath(appPath)) return appPath;
  const slug = projectSlug?.trim();
  if (!slug) return appPath;

  const encoded = encodeURIComponent(slug);
  if (appPath === '/app' || appPath === '/app/') {
    return `/${encoded}/dashboard`;
  }
  if (appPath.startsWith('/app/')) {
    return `/${encoded}${appPath.slice(4)}`;
  }
  return appPath;
}

/**
 * Convert a browser pathname under `/{slug}/...` back to the canonical `/app/...` path.
 * Returns the pathname unchanged when it is not under the given project slug.
 */
export function toCanonicalAppPath(pathname: string, projectSlug?: string | null): string {
  const slug = projectSlug?.trim();
  if (!slug) return pathname;

  const rawPrefix = `/${slug}`;
  const encodedPrefix = `/${encodeURIComponent(slug)}`;

  let rest: string | null = null;
  if (pathname === rawPrefix || pathname === `${rawPrefix}/`) rest = '';
  else if (pathname.startsWith(`${rawPrefix}/`)) rest = pathname.slice(rawPrefix.length);
  else if (pathname === encodedPrefix || pathname === `${encodedPrefix}/`) rest = '';
  else if (pathname.startsWith(`${encodedPrefix}/`)) rest = pathname.slice(encodedPrefix.length);
  else return pathname;

  if (!rest || rest === '/') return '/app';
  if (rest === '/dashboard' || rest.startsWith('/dashboard/')) {
    const after = rest === '/dashboard' ? '' : rest.slice('/dashboard'.length);
    return after ? `/app${after}` : '/app';
  }
  return `/app${rest}`;
}

/** Public project login URL: `/{slug}/login`. */
export function projectLoginPath(projectSlug: string): string {
  return `/${encodeURIComponent(projectSlug.trim())}/login`;
}

/** Project workspace home: `/{slug}/dashboard`. */
export function projectDashboardPath(projectSlug: string): string {
  return `/${encodeURIComponent(projectSlug.trim())}/dashboard`;
}

/** Slugify a project name into a readable public-login slug (e.g. hospital-management). */
export function suggestProjectSlug(projectName: string): string {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 48);
  return base || 'project';
}

/** Slugify a project name into a Postgres database name (e.g. hospital_management_db). */
export function suggestDatabaseName(projectName: string): string {
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 50);
  const name = `${base || 'project'}_db`;
  return name.slice(0, 63);
}
