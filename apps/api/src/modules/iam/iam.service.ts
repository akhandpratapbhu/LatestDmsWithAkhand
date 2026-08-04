import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionType } from '@prisma/client';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { IamSeedService } from './iam-seed.service';
import { ProjectIamSeedService } from './project-iam-seed.service';

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

/** Platform or project Prisma client — IAM models share the same shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDbService,
    private readonly seed: IamSeedService,
    private readonly projectSeed: ProjectIamSeedService,
  ) {}

  private async resolveDb(organizationId: string): Promise<{
    db: TenantDb;
    useProject: boolean;
  }> {
    const project = await this.projectDb.getClient(organizationId);
    if (project) return { db: project, useProject: true };
    return { db: this.prisma, useProject: false };
  }

  async ensureSeeded(organizationId: string, userId: string): Promise<void> {
    const { db, useProject } = await this.resolveDb(organizationId);
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member) return;
    if (useProject) {
      await this.projectSeed.seedOrganization(
        db as ProjectPrismaClient,
        organizationId,
        member.id,
      );
      await this.projectSeed.syncMenuLayout(db as ProjectPrismaClient, organizationId);
    } else {
      await this.seed.seedOrganization(organizationId, member.id);
      await this.seed.syncMenuLayout(organizationId);
    }
  }

  async listRoles(organizationId: string) {
    const { db } = await this.resolveDb(organizationId);
    return db.iamRole.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
        roleMenus: true,
        memberRoles: { select: { member: { select: { userId: true } } } },
        _count: { select: { memberRoles: true, roleMenus: true } },
      },
    });
  }

  /**
   * Ensure `{resource}.view|create|update|delete` permissions exist for every
   * sidebar menu resource (derived from `menu.{resource}` codes). Grants new
   * codes to the system ADMIN role when present.
   */
  async ensureCrudPermissions(organizationId: string): Promise<void> {
    const { db } = await this.resolveDb(organizationId);
    const menus = await db.menu.findMany({
      where: { organizationId, isActive: true },
      include: { permission: true },
    });
    const resources = new Set<string>();
    for (const m of menus as Array<{ permission: { code: string } | null }>) {
      const code = m.permission?.code;
      if (code?.startsWith('menu.')) {
        resources.add(code.slice('menu.'.length));
      }
    }
    if (!resources.size) return;

    const existing = await db.permission.findMany({ where: { organizationId } });
    const byCode = new Map<string, string>(
      (existing as Array<{ id: string; code: string }>).map((p) => [p.code, p.id]),
    );
    const createdIds: string[] = [];
    const actions = [
      { action: 'view', type: 'SCREEN' as const },
      { action: 'create', type: 'API' as const },
      { action: 'update', type: 'API' as const },
      { action: 'delete', type: 'API' as const },
    ];
    for (const resource of resources) {
      for (const { action, type } of actions) {
        const code = `${resource}.${action}`;
        if (byCode.has(code)) continue;
        const created = await db.permission.create({
          data: {
            organizationId,
            code,
            name: `${resource} ${action}`,
            type,
            resource,
            action,
          },
        });
        byCode.set(code, created.id);
        createdIds.push(created.id);
      }
    }
    if (!createdIds.length) return;
    const adminRole = await db.iamRole.findFirst({
      where: { organizationId, code: 'ADMIN', isSystem: true },
    });
    if (!adminRole) return;
    await db.rolePermission.createMany({
      data: createdIds.map((permissionId) => ({
        roleId: adminRole.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
  }

  async getMemberPermissionsForUser(organizationId: string, userId: string) {
    const codes = await this.getMemberPermissionCodes(organizationId, userId);
    const { db } = await this.resolveDb(organizationId);
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: { include: { role: { select: { id: true, name: true, code: true } } } },
      },
    });
    return {
      userId,
      permissionCodes: codes,
      roles: (member?.memberRoles ?? []).map(
        (mr: { role: { id: string; name: string; code: string } }) => mr.role,
      ),
    };
  }

  async createRole(
    organizationId: string,
    data: { name: string; code: string; description?: string; permissionIds?: string[] },
  ) {
    const { db } = await this.resolveDb(organizationId);
    return db.iamRole.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        rolePermissions: data.permissionIds?.length
          ? {
              create: data.permissionIds.map((permissionId) => ({ permissionId })),
            }
          : undefined,
      },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async updateRole(
    organizationId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      permissionIds?: string[];
      menuIds?: string[];
    },
  ) {
    const { db } = await this.resolveDb(organizationId);
    await this.ensureRole(db, organizationId, roleId);
    if (data.permissionIds) {
      await db.rolePermission.deleteMany({ where: { roleId } });
      if (data.permissionIds.length) {
        await db.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    }
    if (data.menuIds) {
      await db.roleMenu.deleteMany({ where: { roleId } });
      if (data.menuIds.length) {
        await db.roleMenu.createMany({
          data: data.menuIds.map((menuId) => ({ roleId, menuId })),
        });
      }
    }
    return db.iamRole.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
      include: {
        rolePermissions: { include: { permission: true } },
        roleMenus: true,
      },
    });
  }

  async listPermissions(organizationId: string, type?: PermissionType) {
    await this.ensureCrudPermissions(organizationId);
    const { db } = await this.resolveDb(organizationId);
    return db.permission.findMany({
      where: { organizationId, ...(type ? { type } : {}) },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async createPermission(
    organizationId: string,
    data: {
      code: string;
      name: string;
      type: PermissionType;
      description?: string;
      resource?: string;
      action?: string;
    },
  ) {
    const { db } = await this.resolveDb(organizationId);
    return db.permission.create({
      data: {
        organizationId,
        code: data.code,
        name: data.name,
        type: data.type,
        description: data.description,
        resource: data.resource,
        action: data.action,
      },
    });
  }

  async listMenuGroups(organizationId: string) {
    await this.ensureCrudPermissions(organizationId);
    const { db } = await this.resolveDb(organizationId);
    return db.menuGroup.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        menus: {
          where: { parentId: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { permission: true } },
            permission: true,
          },
        },
      },
    });
  }

  async createMenuGroup(organizationId: string, data: { name: string; code: string; sortOrder?: number }) {
    const { db } = await this.resolveDb(organizationId);
    return db.menuGroup.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code.toUpperCase(),
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async createMenu(
    organizationId: string,
    data: {
      label: string;
      path?: string;
      icon?: string;
      groupId?: string;
      parentId?: string;
      permissionId?: string;
      sortOrder?: number;
    },
  ) {
    const { db } = await this.resolveDb(organizationId);
    return db.menu.create({
      data: {
        organizationId,
        label: data.label,
        path: data.path,
        icon: data.icon,
        groupId: data.groupId,
        parentId: data.parentId,
        permissionId: data.permissionId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async assignMemberRoles(organizationId: string, userId: string, roleIds: string[]) {
    const { db } = await this.resolveDb(organizationId);
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    const roles = await db.iamRole.findMany({
      where: { organizationId, id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }
    await db.memberRole.deleteMany({ where: { memberId: member.id } });
    if (roleIds.length) {
      await db.memberRole.createMany({
        data: roleIds.map((roleId) => ({ memberId: member.id, roleId })),
      });
    }
    return db.memberRole.findMany({
      where: { memberId: member.id },
      include: { role: true },
    });
  }

  async getMemberPermissionCodes(organizationId: string, userId: string): Promise<string[]> {
    await this.ensureSeeded(organizationId, userId);
    const { db } = await this.resolveDb(organizationId);
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!member) return [];

    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      const all = await db.permission.findMany({ where: { organizationId } });
      return all.map((p: { code: string }) => p.code);
    }

    const codes = new Set<string>();
    for (const mr of member.memberRoles) {
      for (const rp of mr.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }
    return [...codes];
  }

  async getSidebar(organizationId: string, userId: string): Promise<{
    groups: SidebarGroupDto[];
    permissions: string[];
    landingPath: string;
    dataSource: 'project' | 'platform';
  }> {
    await this.ensureSeeded(organizationId, userId);
    const { db, useProject } = await this.resolveDb(organizationId);
    const permissions = await this.getMemberPermissionCodes(organizationId, userId);
    const permissionSet = new Set(permissions);

    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: {
          include: {
            role: { include: { roleMenus: true, landingPages: true } },
          },
        },
      },
    });

    const allowedMenuIds = new Set<string>();
    let landingPath = '/app';
    if (member?.role === 'OWNER' || member?.role === 'ADMIN') {
      const allMenus = await db.menu.findMany({
        where: { organizationId, isActive: true },
      });
      allMenus.forEach((m: { id: string }) => allowedMenuIds.add(m.id));
    } else {
      for (const mr of member?.memberRoles ?? []) {
        mr.role.roleMenus.forEach((rm: { menuId: string }) => allowedMenuIds.add(rm.menuId));
        const landing = mr.role.landingPages.find((l: { isActive: boolean; path: string }) => l.isActive);
        if (landing) landingPath = landing.path;
      }
    }

    const groups = await db.menuGroup.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        menus: {
          where: { isActive: true, parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            permission: true,
            children: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: { permission: true },
            },
          },
        },
      },
    });

    type MenuRow = {
      id: string;
      label: string;
      path: string | null;
      icon: string | null;
      sortOrder: number;
      permission: { code: string } | null;
      children: Array<{
        id: string;
        label: string;
        path: string | null;
        icon: string | null;
        sortOrder: number;
        permission: { code: string } | null;
      }>;
    };

    const mapMenu = (m: MenuRow): SidebarMenuDto | null => {
      if (!allowedMenuIds.has(m.id)) return null;
      if (m.permission && !permissionSet.has(m.permission.code)) return null;
      const children = m.children
        .map((c) => {
          if (!allowedMenuIds.has(c.id)) return null;
          if (c.permission && !permissionSet.has(c.permission.code)) return null;
          return {
            id: c.id,
            label: c.label,
            path: c.path,
            icon: c.icon,
            sortOrder: c.sortOrder,
            children: [] as SidebarMenuDto[],
          };
        })
        .filter(Boolean) as SidebarMenuDto[];
      return {
        id: m.id,
        label: m.label,
        path: m.path,
        icon: m.icon,
        sortOrder: m.sortOrder,
        children,
      };
    };

    const sidebarGroups: SidebarGroupDto[] = (groups as Array<{
      id: string;
      name: string;
      code: string;
      sortOrder: number;
      menus: MenuRow[];
    }>)
      .map((g) => ({
        id: g.id,
        name: g.name,
        code: g.code,
        sortOrder: g.sortOrder,
        menus: g.menus.map(mapMenu).filter(Boolean) as SidebarMenuDto[],
      }))
      .filter((g) => g.menus.length > 0);

    return {
      groups: sidebarGroups,
      permissions,
      landingPath,
      dataSource: useProject ? 'project' : 'platform',
    };
  }

  private async ensureRole(db: TenantDb, organizationId: string, roleId: string) {
    const role = await db.iamRole.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
