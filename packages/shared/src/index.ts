export {
  PROJECT_THEME_IDS,
  PROJECT_THEME_OPTIONS,
  PROJECT_THEME_PRESETS,
  resolveProjectThemeId,
  getProjectThemePreset,
  primaryColorOverrides,
  buildThemeCssVars,
  type ProjectThemeId,
  type ProjectThemeTokens,
  type ProjectThemeOption,
} from './themes';

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
 * Product name: **Project** (Configure System).
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
  /** Installed (activated) feature keys for this project. */
  enabledFeatures: string[];
  /**
   * Subscribed / admin-granted premium feature keys.
   * Features with `requiresSubscription` need both install and subscription to unlock fully.
   */
  featureSubscriptions: string[];
  ownerId: string;
  /** Present on list/mine responses: caller's membership role in this project. */
  membershipRole?: OrgRole;
  createdAt: string;
  updatedAt: string;
  /** Present on create when DB provisioning failed but project metadata was saved. */
  provisioningWarning?: string;
  /** Present on create: true when CREATE DATABASE succeeded. */
  databaseProvisioned?: boolean;
  /**
   * Present on create only: the single project-admin account (password shown once).
   * Platform admins create this user; day-to-day IAM/features are owned by them.
   */
  projectAdmin?: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    /** Plaintext password — only returned on create; never stored. */
    password: string;
    /** Relative login path, e.g. `/hospital-management/login`. */
    loginUrl: string;
    /** True when a new platform User row was created for this email. */
    userCreated: boolean;
  };
};

/** Alias for product-facing Project terminology. */
export type ProjectDto = OrganizationDto;

/** Response from DELETE /organizations/:id (platform admin). */
export type DeleteOrganizationResultDto = {
  id: string;
  name: string;
  databaseName: string | null;
  /** True when a physical Postgres DROP DATABASE ran successfully. */
  databaseDropped: boolean;
  /** Set when DROP failed or was skipped but metadata was still removed. */
  databaseDropWarning?: string;
};

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
  /**
   * When true, installing only shows the nav item; full use requires
   * `featureSubscriptions` (mock checkout or platform-admin grant).
   */
  requiresSubscription?: boolean;
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

/**
 * Live data sources for role dashboard widgets.
 * Hospital sources are scoped by the caller's IAM role (doctor/patient/admin).
 * School sources use Dynamic Form submission counts (Phase-1).
 */
export type DashboardDataSource =
  | 'hospital.pendingAppointments'
  | 'hospital.todayAppointments'
  | 'hospital.totalAppointments'
  | 'hospital.completedAppointments'
  | 'hospital.doctorsCount'
  | 'hospital.patientsCount'
  | 'hospital.upcomingAppointments'
  | 'school.students'
  | 'school.teachers'
  | 'school.classes'
  | 'school.attendanceRecords'
  | 'school.feeCollections'
  | 'school.examResults'
  | 'school.submissionsTotal'
  | 'school.formCount';

export type DashboardWidgetConfig = {
  /** Static display fallback */
  valueLabel?: string;
  body?: string;
  metric?: string;
  chartType?: string;
  series?: Array<{ label: string; value: number }>;
  /** Live metric / list source */
  dataSource?: DashboardDataSource | string;
  /** For `school.formCount` — Dynamic Form code */
  formCode?: string;
  /** Max rows for list widgets */
  limit?: number;
};

export type DashboardWidgetDto = {
  id: string;
  type: WidgetType;
  title: string;
  config: DashboardWidgetConfig & Record<string, unknown>;
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
  updatedAt?: string;
  role?: { id: string; name: string; code: string } | null;
  widgets: DashboardWidgetDto[];
};

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

/** One project's menu tree for the platform sidebar. */
export type ProjectSidebarDto = {
  organizationId: string;
  name: string;
  slug: string;
  enabledFeatures: string[];
  featureSubscriptions: string[];
  groups: SidebarGroupDto[];
};

/** Platform shell Administration links (shown above Projects on `/app/*`). */
export type PlatformAdminMenuItem = {
  label: string;
  path: string;
  /** When set, only show if this feature is installed on the current project. */
  featureId?: string;
};

export type ProjectSidebarsResponse = {
  projects: ProjectSidebarDto[];
};

/**
 * Platform shell paths that stay visible regardless of installed *project* features.
 * Platform Administration menus are gated separately via `PLATFORM_SHELL_FEATURE_CATALOG`.
 */
export const PLATFORM_SHELL_PATHS = ['/app/projects', '/app/platform-features'] as const;

/** Core platform shell features — cannot be uninstalled. */
export const PROTECTED_PLATFORM_FEATURES: readonly string[] = [
  'projects',
  'platform-features',
] as const;

export function isProtectedPlatformFeature(featureId: string): boolean {
  return (PROTECTED_PLATFORM_FEATURES as readonly string[]).includes(featureId);
}

/** Configure System–only entries (not shown on project Features pages). */
export const PLATFORM_SHELL_ONLY_FEATURES: PlatformFeatureCatalogItem[] = [
  {
    id: 'projects',
    name: 'Projects',
    description: 'Project dashboard — create, open, and manage tenant projects.',
    category: 'Core',
    menuPaths: ['/app/projects'],
  },
  {
    id: 'platform-features',
    name: 'Platform features',
    description: 'Enable or disable Configure System features (same catalog as project Features).',
    category: 'Core',
    menuPaths: ['/app/platform-features'],
  },
];

export type PlatformConfigDto = {
  id: string;
  enabledFeatures: string[];
  updatedAt: string;
};

/**
 * Default features installed when a new project is created.
 * Login page is free/default; chat/calls/etc. must be installed per project.
 * Users/roles/features stay so project Access Management + marketplace work out of the box.
 * Menu Builder is optional — install from Features when needed.
 */
export const DEFAULT_ENABLED_FEATURES: string[] = [
  'dashboard',
  'users',
  'roles',
  'login-page',
  'features',
];

/**
 * Core project features. Project admins cannot uninstall these; platform admins can.
 * Marketplace features (chat, forms, …) are always uninstallable by project OWNER/ADMIN.
 */
export const PROTECTED_PROJECT_FEATURES: readonly string[] = [
  'dashboard',
  'users',
  'roles',
  'login-page',
] as const;

/** Whether a catalog feature is core and restricted for uninstall. */
export function isProtectedProjectFeature(featureId: string): boolean {
  return (PROTECTED_PROJECT_FEATURES as readonly string[]).includes(featureId);
}

/** Menu group code for platform-only Administration (hidden inside project workspaces). */
export const ADMINISTRATION_MENU_GROUP_CODE = 'ADMINISTRATION';

/** Paths kept out of Administration (header chrome or Projects section). */
const PLATFORM_ADMIN_HIDDEN_PATHS = new Set([
  '/app',
  '/app/projects',
  '/app/notifications',
  '/app/profile',
  '/app/search',
]);

/**
 * Static Administration links for the platform shell (`/app/*`), shown above Projects.
 * Prefer `platformAdministrationMenusForFeatures()` so enable/disable drives the sidebar.
 */
export const PLATFORM_ADMINISTRATION_MENUS: PlatformAdminMenuItem[] = [
  { label: 'Platform features', path: '/app/platform-features', featureId: 'platform-features' },
  { label: 'Users', path: '/app/users', featureId: 'users' },
  { label: 'Identity & Access', path: '/app/iam', featureId: 'roles' },
  { label: 'Login page', path: '/app/settings/login', featureId: 'login-page' },
  { label: 'Forms', path: '/app/forms', featureId: 'forms' },
  { label: 'Menus', path: '/app/menus', featureId: 'menu-builder' },
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
    name: 'Dashboard Builder',
    description: 'Role dashboards and live widgets.',
    category: 'Builders',
    menuPaths: ['/app/dashboards'],
  },
  {
    id: 'chat',
    name: 'Chat',
    description: 'Project team messaging. Requires a subscription after install.',
    category: 'Workspace',
    menuPaths: ['/app/chat'],
    requiresSubscription: true,
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
    id: 'features',
    name: 'Features',
    description:
      'Install and uninstall project features from the marketplace. Uninstall to hide this page from the sidebar (re-open via Projects → Features).',
    category: 'Configuration',
    menuPaths: ['/app/features'],
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
    description: 'Call history and sessions. Requires a subscription after install.',
    category: 'Workspace',
    menuPaths: ['/app/calls'],
    requiresSubscription: true,
  },
  {
    id: 'login-page',
    name: 'Login page',
    description: 'Project login branding and auth method flags (stored in project DB). Free / default.',
    category: 'Configuration',
    menuPaths: ['/app/settings/login'],
  },
];

/**
 * Configure System Platform features page catalog:
 * shell-only (Projects, Platform features) + full project marketplace
 * (same cards as `/{slug}/features`).
 */
export const PLATFORM_SHELL_FEATURE_CATALOG: PlatformFeatureCatalogItem[] = [
  ...PLATFORM_SHELL_ONLY_FEATURES,
  ...PLATFORM_FEATURE_CATALOG,
];

/**
 * Build Configure System Administration sidebar from enabled platform features.
 * Enable → menu appears; disable → menu removed.
 */
export function platformAdministrationMenusForFeatures(
  enabledFeatures: string[] | null | undefined,
): PlatformAdminMenuItem[] {
  const enabled = new Set(enabledFeatures ?? defaultPlatformEnabledFeatures());
  const items: PlatformAdminMenuItem[] = [];
  const seenPaths = new Set<string>();

  for (const feature of PLATFORM_SHELL_FEATURE_CATALOG) {
    if (feature.comingSoon) continue;
    if (!enabled.has(feature.id)) continue;
    // Projects lives in the Projects section below Administration.
    if (feature.id === 'projects') continue;

    for (const path of feature.menuPaths) {
      if (!path || PLATFORM_ADMIN_HIDDEN_PATHS.has(path) || seenPaths.has(path)) continue;
      seenPaths.add(path);
      items.push({
        label: feature.name,
        path,
        featureId: feature.id,
      });
    }
  }

  return items;
}

/** Default enabled set for new PlatformConfig rows (all installable marketplace + shell cores). */
export function defaultPlatformEnabledFeatures(): string[] {
  return [
    ...PROTECTED_PLATFORM_FEATURES,
    ...PLATFORM_FEATURE_CATALOG.filter((f) => !f.comingSoon).map((f) => f.id),
  ];
}

/**
 * Default features enabled for Configure System.
 * Same marketplace coverage as project Features (`/{slug}/features`), plus shell cores.
 */
export const DEFAULT_PLATFORM_ENABLED_FEATURES: string[] = defaultPlatformEnabledFeatures();

/** Shell catalog shares the marketplace feature shape. */
export type PlatformShellFeatureCatalogItem = PlatformFeatureCatalogItem;

export function getPlatformShellFeatureById(
  featureId: string,
): PlatformFeatureCatalogItem | undefined {
  return PLATFORM_SHELL_FEATURE_CATALOG.find((f) => f.id === featureId);
}

/** Look up a catalog feature by id. */
export function getFeatureById(featureId: string): PlatformFeatureCatalogItem | undefined {
  return PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
}

/** Catalog feature that owns a sidebar menu path (exact match). */
export function getFeatureByMenuPath(path: string): PlatformFeatureCatalogItem | undefined {
  return PLATFORM_FEATURE_CATALOG.find((f) => f.menuPaths.includes(path));
}

/** Whether a catalog feature requires a paid/approved subscription after install. */
export function featureRequiresSubscription(featureId: string): boolean {
  return Boolean(getFeatureById(featureId)?.requiresSubscription);
}

/** Whether the feature is subscribed or admin-granted for the project. */
export function isFeatureSubscribed(
  featureId: string,
  featureSubscriptions: string[] | null | undefined,
): boolean {
  return (featureSubscriptions ?? []).includes(featureId);
}

/**
 * Fully unlocked: installed, and subscribed when the catalog marks it premium.
 * Free features (e.g. login-page) only need to be installed.
 */
export function isFeatureFullyEnabled(
  featureId: string,
  enabledFeatures: string[] | null | undefined,
  featureSubscriptions: string[] | null | undefined,
): boolean {
  const enabled = enabledFeatures ?? [];
  if (!enabled.includes(featureId)) return false;
  if (!featureRequiresSubscription(featureId)) return true;
  return isFeatureSubscribed(featureId, featureSubscriptions);
}

/** Canonical subscribe / paywall path for a premium feature. */
export function featureSubscribeAppPath(featureId: string): string {
  return `/app/features/subscribe/${encodeURIComponent(featureId)}`;
}

/**
 * Resolve the href for a menu path: premium features that are installed but not
 * subscribed open the subscription page instead of the real feature route.
 */
export function resolveFeatureNavAppPath(
  appPath: string,
  enabledFeatures: string[] | null | undefined,
  featureSubscriptions: string[] | null | undefined,
): string {
  const feature = getFeatureByMenuPath(appPath);
  if (!feature?.requiresSubscription) return appPath;
  const enabled = enabledFeatures ?? [];
  if (!enabled.includes(feature.id)) return appPath;
  if (isFeatureSubscribed(feature.id, featureSubscriptions)) return appPath;
  return featureSubscribeAppPath(feature.id);
}

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

/** True when the menu group is platform Administration (hide inside `/{slug}`). */
export function isAdministrationMenuGroup(code: string | null | undefined): boolean {
  return code === ADMINISTRATION_MENU_GROUP_CODE;
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
  return (
    appPath === '/app/projects' ||
    appPath.startsWith('/app/projects/') ||
    appPath === '/app/forms' ||
    appPath.startsWith('/app/forms/') ||
    appPath === '/app/platform-features' ||
    appPath.startsWith('/app/platform-features/')
  );
}

/** Whether a platform Administration menu path is allowed for installed shell features. */
export function isPlatformShellPathAllowed(
  path: string,
  enabledFeatures: string[] | null | undefined,
): boolean {
  if ((PLATFORM_SHELL_PATHS as readonly string[]).includes(path)) return true;
  const enabled = enabledFeatures ?? DEFAULT_PLATFORM_ENABLED_FEATURES;
  for (const feature of PLATFORM_SHELL_FEATURE_CATALOG) {
    if (!enabled.includes(feature.id)) continue;
    if (feature.menuPaths.includes(path)) return true;
  }
  return false;
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
