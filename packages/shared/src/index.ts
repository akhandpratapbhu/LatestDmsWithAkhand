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

export type OrganizationDto = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  isActive: boolean;
  ownerId: string;
  createdAt: string;
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
  sortOrder: number;
  children: SidebarMenuDto[];
};

export type SidebarGroupDto = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
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
