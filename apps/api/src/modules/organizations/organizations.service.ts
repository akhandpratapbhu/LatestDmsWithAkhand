import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  Branch,
  CostCenter,
  Department,
  Designation,
  Organization,
  PasswordPolicy,
  Prisma,
  Team,
  User,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  BranchDto,
  CostCenterDto,
  DEFAULT_ENABLED_FEATURES,
  DeleteOrganizationResultDto,
  DepartmentDto,
  DesignationDto,
  isFeatureFullyEnabled,
  isProtectedProjectFeature,
  OrganizationDto,
  PasswordPolicyDto,
  PLATFORM_FEATURE_CATALOG,
  PlatformFeatureCatalogItem,
  RESERVED_PROJECT_SLUGS,
  projectLoginPath,
  suggestDatabaseName,
  suggestProjectSlug,
  TeamDto,
} from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { IamSeedService } from '../iam/iam-seed.service';
import { IamService } from '../iam/iam.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { UsersService } from '../users/users.service';
import { ProjectDbProvisioner } from './project-db.provisioner';

/** One-time project-admin password when the wizard omits one. */
function generateProjectAdminPassword(): string {
  // Letter + digit required by password policy; base64url for readability.
  return `Aa${randomBytes(12).toString('base64url')}1!`;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IamSeedService))
    private readonly iamSeed: IamSeedService,
    @Inject(forwardRef(() => IamService))
    private readonly iam: IamService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    private readonly dbProvisioner: ProjectDbProvisioner,
    private readonly projectDb: ProjectDbService,
  ) {}

  private parseStringArray(
    value: Prisma.JsonValue | null | undefined,
    fallback: string[] = [],
  ): string[] {
    if (value == null) return [...fallback];
    // Legacy rows / bad writes may store a JSON-encoded string instead of an array.
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string');
        }
      } catch {
        return [...fallback];
      }
      return [...fallback];
    }
    if (!Array.isArray(value)) return [...fallback];
    return value.filter((v): v is string => typeof v === 'string');
  }

  private parseEnabledFeatures(value: Prisma.JsonValue | null | undefined): string[] {
    return this.parseStringArray(value, DEFAULT_ENABLED_FEATURES);
  }

  /** Stored list only — never invent defaults (used by install/uninstall mutations). */
  private readStoredFeatureIds(value: Prisma.JsonValue | null | undefined): string[] {
    return this.parseStringArray(value, []);
  }

  private parseFeatureSubscriptions(value: Prisma.JsonValue | null | undefined): string[] {
    return this.parseStringArray(value, []);
  }

  toOrg(
    o: Organization,
    membershipRole?: OrganizationDto['membershipRole'],
    extras?: Pick<
      OrganizationDto,
      'provisioningWarning' | 'databaseProvisioned' | 'projectAdmin'
    >,
  ): OrganizationDto {
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      code: o.code,
      description: o.description,
      logoUrl: o.logoUrl,
      version: o.version,
      databaseName: o.databaseName,
      isActive: o.isActive,
      status: o.status as OrganizationDto['status'],
      theme: o.theme,
      currency: o.currency,
      language: o.language,
      timezone: o.timezone,
      subdomain: o.subdomain,
      connectionString: o.connectionString,
      enabledFeatures: this.parseEnabledFeatures(o.enabledFeatures),
      featureSubscriptions: this.parseFeatureSubscriptions(o.featureSubscriptions),
      ownerId: o.ownerId,
      ...(membershipRole ? { membershipRole } : {}),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      ...extras,
    };
  }

  toBranch(b: Branch): BranchDto {
    return {
      id: b.id,
      organizationId: b.organizationId,
      name: b.name,
      code: b.code,
      address: b.address,
      city: b.city,
      country: b.country,
      isActive: b.isActive,
      createdAt: b.createdAt.toISOString(),
    };
  }

  toDepartment(d: Department): DepartmentDto {
    return {
      id: d.id,
      organizationId: d.organizationId,
      branchId: d.branchId,
      name: d.name,
      code: d.code,
      isActive: d.isActive,
      createdAt: d.createdAt.toISOString(),
    };
  }

  toDesignation(d: Designation): DesignationDto {
    return {
      id: d.id,
      organizationId: d.organizationId,
      name: d.name,
      code: d.code,
      level: d.level,
      isActive: d.isActive,
      createdAt: d.createdAt.toISOString(),
    };
  }

  toTeam(t: Team): TeamDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      branchId: t.branchId,
      departmentId: t.departmentId,
      name: t.name,
      code: t.code,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    };
  }

  toCostCenter(c: CostCenter): CostCenterDto {
    return {
      id: c.id,
      organizationId: c.organizationId,
      branchId: c.branchId,
      name: c.name,
      code: c.code,
      description: c.description,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    };
  }

  toPolicy(p: PasswordPolicy): PasswordPolicyDto {
    return {
      id: p.id,
      organizationId: p.organizationId,
      minLength: p.minLength,
      requireUppercase: p.requireUppercase,
      requireLowercase: p.requireLowercase,
      requireNumber: p.requireNumber,
      requireSpecialChar: p.requireSpecialChar,
      passwordHistory: p.passwordHistory,
      maxAgeDays: p.maxAgeDays,
    };
  }

  /**
   * Allocate a stable, readable public-login slug from the project name.
   * Collisions (and reserved top-level paths) get a numeric suffix: `hospital-management-2`.
   */
  private async allocateUniqueSlug(name: string): Promise<string> {
    const base = suggestProjectSlug(name);
    let n = RESERVED_PROJECT_SLUGS.has(base) ? 2 : 1;
    let candidate = n === 1 ? base : `${base}-${n}`;

    for (;;) {
      const taken = await this.prisma.organization.findFirst({
        where: {
          OR: [{ slug: candidate }, { subdomain: candidate }],
        },
        select: { id: true },
      });
      if (!taken && !RESERVED_PROJECT_SLUGS.has(candidate)) {
        return candidate;
      }
      n += 1;
      candidate = `${base}-${n}`;
    }
  }

  async createOrganization(
    userId: string,
    data: {
      name: string;
      code?: string;
      description?: string;
      logoUrl?: string;
      theme?: string;
      currency?: string;
      language?: string;
      timezone?: string;
      subdomain?: string;
      status?: string;
      version?: string;
      databaseName?: string;
      enabledFeatures?: string[];
      adminFirstName: string;
      adminLastName: string;
      adminEmail: string;
      adminPassword?: string;
    },
  ): Promise<OrganizationDto> {
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!actor?.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can create projects');
    }

    const adminFirstName = data.adminFirstName.trim();
    const adminLastName = data.adminLastName.trim();
    const adminEmail = data.adminEmail.trim().toLowerCase();
    if (!adminFirstName || !adminLastName) {
      throw new BadRequestException('Project admin first and last name are required');
    }
    if (!adminEmail) {
      throw new BadRequestException('Project admin email is required');
    }

    const adminPasswordPlain =
      data.adminPassword?.trim() || generateProjectAdminPassword();

    // Exactly one project admin: create platform User if email is new, else reuse.
    const existingAdmin = await this.users.findByEmail(adminEmail);
    let userCreated = false;
    let adminUser: User;
    if (!existingAdmin) {
      const created = await this.users.createUser({
        email: adminEmail,
        password: adminPasswordPlain,
        firstName: adminFirstName,
        lastName: adminLastName,
      });
      adminUser = await this.users.markEmailVerified(created.id);
      userCreated = true;
    } else {
      await this.users.updatePassword(existingAdmin.id, adminPasswordPlain);
      adminUser = await this.prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          firstName: adminFirstName,
          lastName: adminLastName,
          status: 'ACTIVE',
          isActive: true,
        },
      });
    }

    const databaseName = (data.databaseName?.trim() || suggestDatabaseName(data.name)).slice(0, 63);
    const enabledFeatures =
      data.enabledFeatures && data.enabledFeatures.length > 0
        ? data.enabledFeatures
        : [...DEFAULT_ENABLED_FEATURES];

    const slug = await this.allocateUniqueSlug(data.name);
    const requestedSubdomain = data.subdomain?.trim().toLowerCase() || null;
    let subdomain = requestedSubdomain || slug;
    if (requestedSubdomain && requestedSubdomain !== slug) {
      const subdomainTaken = await this.prisma.organization.findFirst({
        where: {
          OR: [{ slug: requestedSubdomain }, { subdomain: requestedSubdomain }],
        },
        select: { id: true },
      });
      if (subdomainTaken || RESERVED_PROJECT_SLUGS.has(requestedSubdomain)) {
        throw new BadRequestException('Subdomain is already in use or reserved');
      }
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: data.name,
          code: data.code ?? null,
          description: data.description?.trim() || null,
          logoUrl: data.logoUrl?.trim() || null,
          version: data.version?.trim() || '1.0.0',
          databaseName,
          slug,
          // Project admin owns the project (not the platform operator who clicked Create).
          ownerId: adminUser.id,
          theme: data.theme ?? 'default',
          currency: data.currency ?? 'USD',
          language: data.language ?? 'en',
          timezone: data.timezone ?? 'UTC',
          subdomain,
          status: data.status ?? 'ACTIVE',
          isActive: (data.status ?? 'ACTIVE') !== 'ARCHIVED' && (data.status ?? 'ACTIVE') !== 'SUSPENDED',
          enabledFeatures,
          featureSubscriptions: [],
          members: {
            create: {
              userId: adminUser.id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          },
          passwordPolicy: { create: {} },
        },
        include: { members: true },
      });
      return created;
    });

    // Home org for the project admin when they do not already have one.
    if (!adminUser.organizationId) {
      adminUser = await this.prisma.user.update({
        where: { id: adminUser.id },
        data: { organizationId: org.id },
      });
    }

    const ownerMember = org.members[0];
    // Platform IAM seed remains as fallback for orgs without a project DB.
    if (ownerMember) {
      await this.iamSeed.seedOrganization(org.id, ownerMember.id);
    }

    const provision = await this.dbProvisioner.provision({
      databaseName,
      organizationId: org.id,
      owner: {
        id: adminUser.id,
        email: adminUser.email,
        passwordHash: adminUser.passwordHash,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        phone: adminUser.phone,
        avatarUrl: adminUser.avatarUrl,
      },
    });

    let updated: Organization = org;
    if (provision.ok) {
      updated = await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          databaseName: provision.databaseName,
          // Local/dev: plain connection string until encryption lands later
          connectionString: provision.connectionString,
        },
      });
    } else if (provision.databaseName) {
      // Still record intended database name even when CREATE DATABASE failed.
      updated = await this.prisma.organization.update({
        where: { id: org.id },
        data: { databaseName: provision.databaseName },
      });
    }

    const warningParts: string[] = [];
    if (!provision.ok) {
      warningParts.push(provision.warning);
    } else if (!provision.seeded) {
      warningParts.push(
        `Database "${provision.databaseName}" was created and schema applied, but IAM seed failed. Retry open/seed or check API logs.`,
      );
    }

    return this.toOrg(updated, undefined, {
      databaseProvisioned: provision.ok,
      ...(warningParts.length ? { provisioningWarning: warningParts.join(' ') } : {}),
      projectAdmin: {
        userId: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        password: adminPasswordPlain,
        loginUrl: projectLoginPath(updated.slug),
        userCreated,
      },
    });
  }

  async listMyOrganizations(userId: string): Promise<OrganizationDto[]> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });

    // Platform operators see every project without needing membership.
    if (actor?.isPlatformAdmin) {
      const orgs = await this.prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
      });
      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { organizationId: true, role: true },
      });
      const roleByOrg = new Map(memberships.map((m) => [m.organizationId, m.role]));
      return orgs.map((o) =>
        this.toOrg(o, roleByOrg.get(o.id) as OrganizationDto['membershipRole'] | undefined),
      );
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) =>
      this.toOrg(m.organization, m.role as OrganizationDto['membershipRole']),
    );
  }

  async getOrganization(orgId: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return this.toOrg(org);
  }

  /**
   * Platform-admin only: remove project metadata (cascades members, forms, IAM, …)
   * and DROP the provisioned Postgres database when present.
   *
   * When DROP fails and `force` is false, throws so the UI can confirm metadata-only removal.
   * When `force` is true, metadata is deleted even if DROP fails (warning returned).
   */
  async deleteOrganization(
    actorUserId: string,
    organizationId: string,
    opts?: { force?: boolean },
  ): Promise<DeleteOrganizationResultDto> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isPlatformAdmin: true },
    });
    if (!actor?.isPlatformAdmin) {
      throw new ForbiddenException('Only platform admins can delete projects');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    await this.projectDb.evictClient(organizationId);

    let databaseDropped = false;
    let databaseDropWarning: string | undefined;

    const dbName = org.databaseName?.trim() || null;
    if (dbName || org.connectionString?.trim()) {
      if (!dbName) {
        databaseDropWarning =
          'Project had a connectionString but no databaseName; skipped DROP DATABASE.';
      } else {
        const drop = await this.dbProvisioner.dropDatabase(dbName);
        if (drop.ok) {
          databaseDropped = drop.dropped;
        } else {
          databaseDropWarning = drop.warning;
          if (!opts?.force) {
            throw new BadRequestException({
              message: drop.warning,
              code: 'PROJECT_DB_DROP_FAILED',
              databaseName: dbName,
              hint: 'Retry with force=true to remove project metadata without dropping the database.',
            });
          }
        }
      }
    }

    await this.prisma.organization.delete({ where: { id: organizationId } });

    return {
      id: org.id,
      name: org.name,
      databaseName: dbName,
      databaseDropped,
      ...(databaseDropWarning ? { databaseDropWarning } : {}),
    };
  }

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      code?: string;
      description?: string | null;
      logoUrl?: string | null;
      version?: string;
      databaseName?: string;
      isActive?: boolean;
      theme?: string;
      currency?: string;
      language?: string;
      timezone?: string;
      subdomain?: string | null;
      status?: string;
      enabledFeatures?: string[];
    },
  ): Promise<OrganizationDto> {
    const patch: Prisma.OrganizationUpdateInput = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.code !== undefined) patch.code = data.code;
    if (data.description !== undefined) patch.description = data.description;
    if (data.logoUrl !== undefined) patch.logoUrl = data.logoUrl;
    if (data.version !== undefined) patch.version = data.version;
    if (data.databaseName !== undefined) patch.databaseName = data.databaseName;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.language !== undefined) patch.language = data.language;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.subdomain !== undefined) patch.subdomain = data.subdomain;
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.isActive === undefined) {
        patch.isActive = data.status !== 'ARCHIVED' && data.status !== 'SUSPENDED';
      }
    }
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.enabledFeatures !== undefined) patch.enabledFeatures = data.enabledFeatures;
    const org = await this.prisma.organization.update({ where: { id: orgId }, data: patch });
    return this.toOrg(org);
  }

  listFeatureCatalog(): PlatformFeatureCatalogItem[] {
    return PLATFORM_FEATURE_CATALOG;
  }

  async installFeature(orgId: string, featureId: string): Promise<OrganizationDto> {
    const feature = PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) throw new BadRequestException(`Unknown feature: ${featureId}`);
    if (feature.comingSoon) {
      throw new BadRequestException(`${feature.name} is coming soon and cannot be installed yet`);
    }
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const current = this.readStoredFeatureIds(org.enabledFeatures);
    if (current.includes(featureId)) {
      await this.iam.setFeatureMenusActive(orgId, featureId, true);
      return this.toOrg(org);
    }
    const enabledFeatures = [...current, featureId];
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { enabledFeatures },
    });
    await this.iam.setFeatureMenusActive(orgId, featureId, true);
    return this.toOrg(updated);
  }

  async uninstallFeature(
    orgId: string,
    featureId: string,
    actorUserId?: string,
  ): Promise<OrganizationDto> {
    const feature = PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) throw new BadRequestException(`Unknown feature: ${featureId}`);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    if (isProtectedProjectFeature(featureId)) {
      let isPlatformAdmin = false;
      if (actorUserId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: actorUserId },
          select: { isPlatformAdmin: true },
        });
        isPlatformAdmin = Boolean(actor?.isPlatformAdmin);
      }
      if (!isPlatformAdmin) {
        throw new ForbiddenException(
          `${feature.name} is a core project feature. Only a platform admin can uninstall it.`,
        );
      }
    }

    const enabledFeatures = this.readStoredFeatureIds(org.enabledFeatures).filter(
      (id) => id !== featureId,
    );
    const featureSubscriptions = this.parseFeatureSubscriptions(org.featureSubscriptions).filter(
      (id) => id !== featureId,
    );
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { enabledFeatures, featureSubscriptions },
    });
    await this.iam.setFeatureMenusActive(orgId, featureId, false);
    return this.toOrg(updated);
  }

  /**
   * Mock Stripe checkout / admin grant: mark a premium feature as subscribed for the project.
   * Free features (no requiresSubscription) are treated as already available once installed.
   */
  async subscribeFeature(
    orgId: string,
    featureId: string,
    opts?: { provider?: string; grantAsPlatformAdmin?: boolean },
  ): Promise<OrganizationDto> {
    const feature = PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) throw new BadRequestException(`Unknown feature: ${featureId}`);
    if (feature.comingSoon) {
      throw new BadRequestException(`${feature.name} is coming soon`);
    }
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const enabledFeatures = this.readStoredFeatureIds(org.enabledFeatures);
    if (!enabledFeatures.includes(featureId)) {
      throw new BadRequestException(
        `${feature.name} must be installed before it can be subscribed`,
      );
    }

    const current = this.parseFeatureSubscriptions(org.featureSubscriptions);
    if (current.includes(featureId)) return this.toOrg(org);

    // Free features do not need a subscription entry; keep list for premium only.
    if (!feature.requiresSubscription) return this.toOrg(org);

    const featureSubscriptions = [...current, featureId];
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { featureSubscriptions },
    });
    void opts;
    return this.toOrg(updated);
  }

  async unsubscribeFeature(orgId: string, featureId: string): Promise<OrganizationDto> {
    const feature = PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) throw new BadRequestException(`Unknown feature: ${featureId}`);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    const featureSubscriptions = this.parseFeatureSubscriptions(org.featureSubscriptions).filter(
      (id) => id !== featureId,
    );
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { featureSubscriptions },
    });
    return this.toOrg(updated);
  }

  /** Whether a premium feature is fully unlocked for API/route use. */
  isFeatureUnlocked(org: Organization, featureId: string): boolean {
    const enabled = this.parseEnabledFeatures(org.enabledFeatures);
    const subs = this.parseFeatureSubscriptions(org.featureSubscriptions);
    return isFeatureFullyEnabled(featureId, enabled, subs);
  }

  // Branches
  async listBranches(orgId: string): Promise<BranchDto[]> {
    const rows = await this.prisma.branch.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toBranch(r));
  }

  async createBranch(
    orgId: string,
    data: {
      name: string;
      code: string;
      address?: string;
      city?: string;
      country?: string;
    },
  ): Promise<BranchDto> {
    const row = await this.prisma.branch.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address,
        city: data.city,
        country: data.country,
      },
    });
    return this.toBranch(row);
  }

  async updateBranch(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      address: string;
      city: string;
      country: string;
      isActive: boolean;
    }>,
  ): Promise<BranchDto> {
    await this.ensureBranch(orgId, id);
    const row = await this.prisma.branch.update({ where: { id }, data });
    return this.toBranch(row);
  }

  async deleteBranch(orgId: string, id: string): Promise<void> {
    await this.ensureBranch(orgId, id);
    await this.prisma.branch.delete({ where: { id } });
  }

  // Departments
  async listDepartments(orgId: string): Promise<DepartmentDto[]> {
    const rows = await this.prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDepartment(r));
  }

  async createDepartment(
    orgId: string,
    data: { name: string; code: string; branchId?: string },
  ): Promise<DepartmentDto> {
    if (data.branchId) await this.ensureBranch(orgId, data.branchId);
    const row = await this.prisma.department.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        branchId: data.branchId,
      },
    });
    return this.toDepartment(row);
  }

  async updateDepartment(
    orgId: string,
    id: string,
    data: Partial<{ name: string; branchId: string | null; isActive: boolean }>,
  ): Promise<DepartmentDto> {
    await this.ensureDepartment(orgId, id);
    if (data.branchId) await this.ensureBranch(orgId, data.branchId);
    const row = await this.prisma.department.update({ where: { id }, data });
    return this.toDepartment(row);
  }

  async deleteDepartment(orgId: string, id: string): Promise<void> {
    await this.ensureDepartment(orgId, id);
    await this.prisma.department.delete({ where: { id } });
  }

  // Designations
  async listDesignations(orgId: string): Promise<DesignationDto[]> {
    const rows = await this.prisma.designation.findMany({
      where: { organizationId: orgId },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toDesignation(r));
  }

  async createDesignation(
    orgId: string,
    data: { name: string; code: string; level?: number },
  ): Promise<DesignationDto> {
    const row = await this.prisma.designation.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        level: data.level ?? 1,
      },
    });
    return this.toDesignation(row);
  }

  async updateDesignation(
    orgId: string,
    id: string,
    data: Partial<{ name: string; level: number; isActive: boolean }>,
  ): Promise<DesignationDto> {
    await this.ensureDesignation(orgId, id);
    const row = await this.prisma.designation.update({ where: { id }, data });
    return this.toDesignation(row);
  }

  async deleteDesignation(orgId: string, id: string): Promise<void> {
    await this.ensureDesignation(orgId, id);
    await this.prisma.designation.delete({ where: { id } });
  }

  // Teams
  async listTeams(orgId: string): Promise<TeamDto[]> {
    const rows = await this.prisma.team.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toTeam(r));
  }

  async createTeam(
    orgId: string,
    data: { name: string; code: string; branchId?: string; departmentId?: string },
  ): Promise<TeamDto> {
    if (data.branchId) await this.ensureBranch(orgId, data.branchId);
    if (data.departmentId) await this.ensureDepartment(orgId, data.departmentId);
    const row = await this.prisma.team.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        branchId: data.branchId,
        departmentId: data.departmentId,
      },
    });
    return this.toTeam(row);
  }

  async updateTeam(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      branchId: string | null;
      departmentId: string | null;
      isActive: boolean;
    }>,
  ): Promise<TeamDto> {
    await this.ensureTeam(orgId, id);
    const row = await this.prisma.team.update({ where: { id }, data });
    return this.toTeam(row);
  }

  async deleteTeam(orgId: string, id: string): Promise<void> {
    await this.ensureTeam(orgId, id);
    await this.prisma.team.delete({ where: { id } });
  }

  // Cost centers
  async listCostCenters(orgId: string): Promise<CostCenterDto[]> {
    const rows = await this.prisma.costCenter.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toCostCenter(r));
  }

  async createCostCenter(
    orgId: string,
    data: { name: string; code: string; branchId?: string; description?: string },
  ): Promise<CostCenterDto> {
    if (data.branchId) await this.ensureBranch(orgId, data.branchId);
    const row = await this.prisma.costCenter.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        branchId: data.branchId,
        description: data.description,
      },
    });
    return this.toCostCenter(row);
  }

  async updateCostCenter(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      branchId: string | null;
      description: string;
      isActive: boolean;
    }>,
  ): Promise<CostCenterDto> {
    await this.ensureCostCenter(orgId, id);
    const row = await this.prisma.costCenter.update({ where: { id }, data });
    return this.toCostCenter(row);
  }

  async deleteCostCenter(orgId: string, id: string): Promise<void> {
    await this.ensureCostCenter(orgId, id);
    await this.prisma.costCenter.delete({ where: { id } });
  }

  async getPasswordPolicy(orgId: string): Promise<PasswordPolicyDto> {
    const policy =
      (await this.prisma.passwordPolicy.findUnique({ where: { organizationId: orgId } })) ??
      (await this.prisma.passwordPolicy.create({ data: { organizationId: orgId } }));
    return this.toPolicy(policy);
  }

  async updatePasswordPolicy(
    orgId: string,
    data: Partial<{
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumber: boolean;
      requireSpecialChar: boolean;
      passwordHistory: number;
      maxAgeDays: number | null;
    }>,
  ): Promise<PasswordPolicyDto> {
    await this.getPasswordPolicy(orgId);
    const policy = await this.prisma.passwordPolicy.update({
      where: { organizationId: orgId },
      data,
    });
    return this.toPolicy(policy);
  }

  private async ensureBranch(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.branch.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Branch not found');
  }

  private async ensureDepartment(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.department.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Department not found');
  }

  private async ensureDesignation(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.designation.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Designation not found');
  }

  private async ensureTeam(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.team.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Team not found');
  }

  private async ensureCostCenter(orgId: string, id: string): Promise<void> {
    const row = await this.prisma.costCenter.findFirst({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('Cost center not found');
  }
}
