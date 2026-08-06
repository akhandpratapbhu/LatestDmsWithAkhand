import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionType } from '@prisma/client';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { DEFAULT_ENABLED_FEATURES, PLATFORM_FEATURE_CATALOG } from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { IamSeedService } from './iam-seed.service';
import { ProjectIamSeedService } from './project-iam-seed.service';

export type SidebarMenuDto = {
  id: string;
  label: string;
  path: string | null;
  icon: string | null;
  formId: string | null;
  permissionCode: string | null;
  sortOrder: number;
  children: SidebarMenuDto[];
};

export type SidebarGroupDto = {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  /** When true, AppShell renders menus as outer top-level items (no group toggle). */
  isOuter?: boolean;
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
    await this.syncFeatureMenuVisibility(organizationId);
  }

  /**
   * Keep IAM menu isActive flags aligned with installed features.
   * syncMenuLayout may reactivate catalog paths; this re-applies install/uninstall state.
   */
  private async syncFeatureMenuVisibility(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { enabledFeatures: true },
    });
    if (!org) return;

    const stored = Array.isArray(org.enabledFeatures)
      ? (org.enabledFeatures as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    const enabled = new Set(stored.length > 0 ? stored : DEFAULT_ENABLED_FEATURES);

    for (const feature of PLATFORM_FEATURE_CATALOG) {
      if (feature.menuPaths.length === 0) continue;
      await this.setFeatureMenusActive(organizationId, feature.id, enabled.has(feature.id));
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

  /** Slug used as IAM resource key: menu.{resource} + {resource}.view|create|… */
  private slugifyResource(label: string): string {
    const slug = label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    return slug || 'custom';
  }

  /**
   * Bind a `menu.{resource}` permission to a menu that lacks one (Menu Builder
   * custom items). Grants the new MENU permission to system ADMIN and to any
   * role that already has this menu assigned (preserves existing access).
   */
  private async ensureMenuHasPermission(
    db: TenantDb,
    organizationId: string,
    menu: { id: string; label: string; permissionId: string | null },
  ): Promise<string> {
    if (menu.permissionId) return menu.permissionId;

    let resource = this.slugifyResource(menu.label);
    let code = `menu.${resource}`;

    let existing = await db.permission.findFirst({
      where: { organizationId, code },
    });
    if (existing) {
      const boundElsewhere = await db.menu.findFirst({
        where: {
          organizationId,
          permissionId: existing.id,
          NOT: { id: menu.id },
        },
        select: { id: true },
      });
      if (boundElsewhere) {
        resource = `${resource}_${menu.id.replace(/-/g, '').slice(0, 8)}`;
        code = `menu.${resource}`;
        existing = await db.permission.findFirst({
          where: { organizationId, code },
        });
      }
    }

    const createdIds: string[] = [];
    if (!existing) {
      existing = await db.permission.create({
        data: {
          organizationId,
          code,
          name: `${menu.label} menu`,
          type: 'MENU' as PermissionType,
          resource,
          action: 'access',
        },
      });
      createdIds.push(existing.id);
    }

    await db.menu.update({
      where: { id: menu.id },
      data: { permissionId: existing.id },
    });

    const grantRoleIds = new Set<string>();
    const adminRole = await db.iamRole.findFirst({
      where: { organizationId, code: 'ADMIN', isSystem: true },
    });
    if (adminRole) grantRoleIds.add(adminRole.id);

    const roleMenus = await db.roleMenu.findMany({
      where: { menuId: menu.id },
      select: { roleId: true },
    });
    for (const rm of roleMenus as Array<{ roleId: string }>) {
      grantRoleIds.add(rm.roleId);
    }

    if (grantRoleIds.size) {
      await db.rolePermission.createMany({
        data: [...grantRoleIds].map((roleId) => ({
          roleId,
          permissionId: existing.id,
        })),
        skipDuplicates: true,
      });
    }

    void createdIds;
    return existing.id as string;
  }

  /**
   * Backfill missing menu.* bindings, then ensure
   * `{resource}.view|create|update|delete` for every menu resource.
   * Grants new codes to the system ADMIN role when present.
   */
  async ensureCrudPermissions(organizationId: string): Promise<void> {
    const { db } = await this.resolveDb(organizationId);
    const menus = await db.menu.findMany({
      where: { organizationId, isActive: true },
      include: { permission: true },
    });

    for (const m of menus as Array<{
      id: string;
      label: string;
      permissionId: string | null;
      permission: { code: string } | null;
    }>) {
      if (!m.permission?.code?.startsWith('menu.')) {
        await this.ensureMenuHasPermission(db, organizationId, {
          id: m.id,
          label: m.label,
          // Force (re)bind when missing or not a menu.* code
          permissionId: null,
        });
      }
    }

    const boundMenus = await db.menu.findMany({
      where: { organizationId, isActive: true },
      include: { permission: true },
    });
    const resources = new Set<string>();
    for (const m of boundMenus as Array<{ permission: { code: string } | null }>) {
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

  async listMenuGroups(organizationId: string, forPermissions = false) {
    await this.ensureCrudPermissions(organizationId);
    const { db } = await this.resolveDb(organizationId);
    const menuInclude = {
      children: {
        orderBy: { sortOrder: 'asc' as const },
        include: { permission: true },
      },
      permission: true,
    };
    const groups = await db.menuGroup.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
      include: {
        menus: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: menuInclude,
        },
      },
    });

    /** Platform admin IA — never assignable via the role permissions matrix. */
    const EXCLUDED_PERMISSION_CODES = new Set([
      'ADMINISTRATION',
      'ACCESS',
      'CONFIG',
      'ADMIN',
    ]);

    const filtered = forPermissions
      ? groups.filter(
          (g: { code: string; excludeFromPermissions?: boolean }) =>
            !g.excludeFromPermissions && !EXCLUDED_PERMISSION_CODES.has(g.code),
        )
      : groups;

    const ungroupedMenus = await db.menu.findMany({
      where: { organizationId, groupId: null, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: menuInclude,
    });
    if (ungroupedMenus.length === 0) return filtered;
    if (forPermissions) return filtered;
    return [
      ...filtered,
      {
        id: '__outer__',
        name: 'Outer (no main menu)',
        code: '_OUTER',
        sortOrder: 9999,
        isActive: true,
        excludeFromPermissions: false,
        organizationId,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        menus: ungroupedMenus,
        isOuter: true,
      },
    ];
  }

  private menuGroupCodeFromName(name: string): string {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return base || 'MAIN';
  }

  async createMenuGroup(
    organizationId: string,
    data: { name: string; code?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const { db } = await this.resolveDb(organizationId);
    const requested = (data.code?.trim() || this.menuGroupCodeFromName(data.name)).toUpperCase();
    let code = requested;
    let suffix = 2;
    while (await db.menuGroup.findFirst({ where: { organizationId, code } })) {
      code = `${requested.slice(0, 36)}_${suffix}`;
      suffix += 1;
    }
    return db.menuGroup.create({
      data: {
        organizationId,
        name: data.name.trim(),
        code,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateMenuGroup(
    organizationId: string,
    groupId: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const { db } = await this.resolveDb(organizationId);
    const existing = await db.menuGroup.findFirst({
      where: { id: groupId, organizationId },
    });
    if (!existing) throw new NotFoundException('Main menu not found');
    return db.menuGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteMenuGroup(organizationId: string, groupId: string) {
    const { db } = await this.resolveDb(organizationId);
    const existing = await db.menuGroup.findFirst({
      where: { id: groupId, organizationId },
      include: { menus: { where: { isActive: true }, select: { id: true }, take: 1 } },
    });
    if (!existing) throw new NotFoundException('Main menu not found');
    if (existing.menus.length) {
      throw new BadRequestException('Remove or move submenus before deleting this main menu');
    }
    await db.menuGroup.delete({ where: { id: groupId } });
    return { ok: true };
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
      formId?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const { db } = await this.resolveDb(organizationId);
    let groupId = data.groupId ?? null;
    if (data.groupId) {
      const group = await db.menuGroup.findFirst({
        where: { id: data.groupId, organizationId },
      });
      if (!group) throw new BadRequestException('Parent main menu not found');
    }
    if (data.parentId) {
      const parent = await db.menu.findFirst({
        where: { id: data.parentId, organizationId },
      });
      if (!parent) throw new BadRequestException('Parent menu not found');
      groupId = groupId ?? parent.groupId ?? null;
    }
    const formId = data.formId?.trim() || null;
    const path =
      formId != null
        ? data.path?.trim() || `/app/data/${formId}`
        : data.path?.trim() || null;
    const created = await db.menu.create({
      data: {
        organizationId,
        label: data.label,
        path,
        icon: data.icon,
        groupId,
        parentId: data.parentId,
        permissionId: data.permissionId ?? null,
        formId,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
    if (!created.permissionId) {
      await this.ensureMenuHasPermission(db, organizationId, {
        id: created.id,
        label: created.label,
        permissionId: created.permissionId,
      });
    }
    await this.ensureCrudPermissions(organizationId);
    return db.menu.findFirst({
      where: { id: created.id },
      include: { permission: true },
    });
  }

  async updateMenu(
    organizationId: string,
    menuId: string,
    data: {
      label?: string;
      path?: string | null;
      icon?: string | null;
      groupId?: string | null;
      parentId?: string | null;
      permissionId?: string | null;
      formId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const { db } = await this.resolveDb(organizationId);
    const existing = await db.menu.findFirst({
      where: { id: menuId, organizationId },
    });
    if (!existing) throw new NotFoundException('Menu not found');

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === menuId) {
        throw new BadRequestException('Menu cannot be its own parent');
      }
      const parent = await db.menu.findFirst({
        where: { id: data.parentId, organizationId },
      });
      if (!parent) throw new BadRequestException('Parent menu not found');
    }

    if (data.groupId !== undefined && data.groupId !== null) {
      const group = await db.menuGroup.findFirst({
        where: { id: data.groupId, organizationId },
      });
      if (!group) throw new BadRequestException('Parent main menu not found');
    }

    const nextFormId =
      data.formId === undefined
        ? existing.formId
        : data.formId?.trim() || null;

    let nextPath: string | null | undefined = data.path;
    if (data.formId !== undefined) {
      if (nextFormId) {
        nextPath =
          data.path !== undefined && data.path !== null && data.path.trim()
            ? data.path.trim()
            : `/app/data/${nextFormId}`;
      } else if (data.path === undefined) {
        // Cleared form link — keep existing path unless it was the auto data path
        if (existing.formId && existing.path === `/app/data/${existing.formId}`) {
          nextPath = null;
        }
      }
    }

    const updated = await db.menu.update({
      where: { id: menuId },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(nextPath !== undefined ? { path: nextPath } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        ...(data.permissionId !== undefined ? { permissionId: data.permissionId } : {}),
        ...(data.formId !== undefined ? { formId: nextFormId } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (!updated.permissionId) {
      await this.ensureMenuHasPermission(db, organizationId, {
        id: updated.id,
        label: updated.label,
        permissionId: updated.permissionId,
      });
      await this.ensureCrudPermissions(organizationId);
    }

    return db.menu.findFirst({
      where: { id: menuId },
      include: { permission: true },
    });
  }

  async deleteMenu(organizationId: string, menuId: string) {
    const { db } = await this.resolveDb(organizationId);
    const existing = await db.menu.findFirst({
      where: { id: menuId, organizationId },
      include: { children: { where: { isActive: true }, select: { id: true } } },
    });
    if (!existing) throw new NotFoundException('Menu not found');
    if (existing.children.length) {
      throw new BadRequestException('Remove or reassign submenus before deleting this menu');
    }
    await db.roleMenu.deleteMany({ where: { menuId } });
    await db.menu.delete({ where: { id: menuId } });
    return { ok: true };
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

    const platformUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (platformUser?.isPlatformAdmin) {
      const all = await db.permission.findMany({ where: { organizationId } });
      return all.map((p: { code: string }) => p.code);
    }

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
    await this.ensureCrudPermissions(organizationId);
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
    const platformUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    const isOrgAdmin =
      Boolean(platformUser?.isPlatformAdmin) ||
      member?.role === 'OWNER' ||
      member?.role === 'ADMIN';
    if (isOrgAdmin) {
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

    const ungroupedMenus = await db.menu.findMany({
      where: { organizationId, isActive: true, parentId: null, groupId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        permission: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { permission: true },
        },
      },
    });

    type MenuRow = {
      id: string;
      label: string;
      path: string | null;
      icon: string | null;
      formId: string | null;
      sortOrder: number;
      permission: { code: string } | null;
      children: Array<{
        id: string;
        label: string;
        path: string | null;
        icon: string | null;
        formId: string | null;
        sortOrder: number;
        permission: { code: string } | null;
      }>;
    };

    const mapMenu = (m: MenuRow): SidebarMenuDto | null => {
      const children = m.children
        .map((c) => {
          if (!allowedMenuIds.has(c.id)) return null;
          if (c.permission && !permissionSet.has(c.permission.code)) return null;
          return {
            id: c.id,
            label: c.label,
            path: c.path,
            icon: c.icon,
            formId: c.formId,
            permissionCode: c.permission?.code ?? null,
            sortOrder: c.sortOrder,
            children: [] as SidebarMenuDto[],
          };
        })
        .filter(Boolean) as SidebarMenuDto[];

      // Folder / section parents (no path): show when any child is allowed
      if (!m.path && !m.formId) {
        if (children.length === 0) return null;
        return {
          id: m.id,
          label: m.label,
          path: null,
          icon: m.icon,
          formId: m.formId,
          permissionCode: m.permission?.code ?? null,
          sortOrder: m.sortOrder,
          children,
        };
      }

      if (!allowedMenuIds.has(m.id)) return null;
      if (m.permission && !permissionSet.has(m.permission.code)) return null;
      return {
        id: m.id,
        label: m.label,
        path: m.path,
        icon: m.icon,
        formId: m.formId,
        permissionCode: m.permission?.code ?? null,
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

    const outerMenus = (ungroupedMenus as MenuRow[])
      .map(mapMenu)
      .filter(Boolean) as SidebarMenuDto[];
    if (outerMenus.length > 0) {
      sidebarGroups.unshift({
        id: '__outer__',
        name: '',
        code: '_OUTER',
        sortOrder: -1,
        isOuter: true,
        menus: outerMenus,
      });
    }

    return {
      groups: sidebarGroups,
      permissions,
      landingPath,
      dataSource: useProject ? 'project' : 'platform',
    };
  }

  private parseEnabledFeatures(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === 'string');
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === 'string');
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseFeatureSubscriptions(raw: unknown): string[] {
    return this.parseEnabledFeatures(raw);
  }

  /**
   * Activate or deactivate IAM menus owned by a catalog feature (project or platform DB).
   * Keeps sidebar in sync when features are installed / uninstalled.
   */
  async setFeatureMenusActive(
    organizationId: string,
    featureId: string,
    isActive: boolean,
  ): Promise<void> {
    const feature = PLATFORM_FEATURE_CATALOG.find((f) => f.id === featureId);
    if (!feature) return;

    const { db } = await this.resolveDb(organizationId);
    const paths = [...feature.menuPaths];

    if (paths.length > 0) {
      await db.menu.updateMany({
        where: { organizationId, path: { in: paths } },
        data: { isActive },
      });
    }

    // Form-linked menus (`/app/data/:formId`) are gated by “{Project} Forms” (project-forms).
    if (featureId === 'project-forms') {
      await db.menu.updateMany({
        where: { organizationId, path: { startsWith: '/app/data/' } },
        data: { isActive },
      });
    }
  }

  /** Sidebar menu trees for all projects the user is an active member of. */
  async listProjectSidebars(userId: string): Promise<{
    projects: Array<{
      organizationId: string;
      name: string;
      slug: string;
      enabledFeatures: string[];
      featureSubscriptions: string[];
      groups: SidebarGroupDto[];
    }>;
  }> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        organization: { isActive: true },
      },
      include: { organization: true },
      orderBy: { organization: { name: 'asc' } },
    });

    const projects = await Promise.all(
      memberships.map(async (m) => {
        const sidebar = await this.getSidebar(m.organizationId, userId);
        return {
          organizationId: m.organizationId,
          name: m.organization.name,
          slug: m.organization.slug,
          enabledFeatures: this.parseEnabledFeatures(m.organization.enabledFeatures),
          featureSubscriptions: this.parseFeatureSubscriptions(m.organization.featureSubscriptions),
          groups: sidebar.groups,
        };
      }),
    );

    return { projects };
  }

  private async ensureRole(db: TenantDb, organizationId: string, roleId: string) {
    const role = await db.iamRole.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
