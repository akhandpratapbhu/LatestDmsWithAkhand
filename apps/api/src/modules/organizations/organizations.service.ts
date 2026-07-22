import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import {
  Branch,
  CostCenter,
  Department,
  Designation,
  Organization,
  PasswordPolicy,
  Team,
} from '@prisma/client';
import {
  BranchDto,
  CostCenterDto,
  DepartmentDto,
  DesignationDto,
  OrganizationDto,
  PasswordPolicyDto,
  TeamDto,
} from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { IamSeedService } from '../iam/iam-seed.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IamSeedService))
    private readonly iamSeed: IamSeedService,
  ) {}

  toOrg(o: Organization): OrganizationDto {
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      code: o.code,
      isActive: o.isActive,
      ownerId: o.ownerId,
      createdAt: o.createdAt.toISOString(),
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

  private slugify(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return `${base || 'org'}-${Date.now().toString(36)}`;
  }

  async createOrganization(userId: string, name: string, code?: string): Promise<OrganizationDto> {
    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name,
          code: code ?? null,
          slug: this.slugify(name),
          ownerId: userId,
          members: {
            create: {
              userId,
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

    const ownerMember = org.members[0];
    if (ownerMember) {
      await this.iamSeed.seedOrganization(org.id, ownerMember.id);
    }

    return this.toOrg(org);
  }

  async listMyOrganizations(userId: string): Promise<OrganizationDto[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => this.toOrg(m.organization));
  }

  async getOrganization(orgId: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return this.toOrg(org);
  }

  async updateOrganization(
    orgId: string,
    data: { name?: string; code?: string; isActive?: boolean },
  ): Promise<OrganizationDto> {
    const org = await this.prisma.organization.update({ where: { id: orgId }, data });
    return this.toOrg(org);
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
