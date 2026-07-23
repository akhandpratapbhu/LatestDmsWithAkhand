import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IamSeedService } from './iam-seed.service';

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

@Injectable()
export class IamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seed: IamSeedService,
  ) {}

  async ensureSeeded(organizationId: string, userId: string): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member) return;
    await this.seed.seedOrganization(organizationId, member.id);
    await this.seed.syncMenuLayout(organizationId);
  }

  async listRoles(organizationId: string) {
    return this.prisma.iamRole.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { memberRoles: true, roleMenus: true } },
      },
    });
  }

  async createRole(
    organizationId: string,
    data: { name: string; code: string; description?: string; permissionIds?: string[] },
  ) {
    const role = await this.prisma.iamRole.create({
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
    return role;
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
    await this.ensureRole(organizationId, roleId);
    if (data.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
      if (data.permissionIds.length) {
        await this.prisma.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
    }
    if (data.menuIds) {
      await this.prisma.roleMenu.deleteMany({ where: { roleId } });
      if (data.menuIds.length) {
        await this.prisma.roleMenu.createMany({
          data: data.menuIds.map((menuId) => ({ roleId, menuId })),
        });
      }
    }
    return this.prisma.iamRole.update({
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
    return this.prisma.permission.findMany({
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
    return this.prisma.permission.create({
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
    return this.prisma.menuGroup.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
      include: {
        menus: {
          where: { parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: { children: { orderBy: { sortOrder: 'asc' } }, permission: true },
        },
      },
    });
  }

  async createMenuGroup(organizationId: string, data: { name: string; code: string; sortOrder?: number }) {
    return this.prisma.menuGroup.create({
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
    return this.prisma.menu.create({
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
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    const roles = await this.prisma.iamRole.findMany({
      where: { organizationId, id: { in: roleIds } },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid');
    }
    await this.prisma.memberRole.deleteMany({ where: { memberId: member.id } });
    if (roleIds.length) {
      await this.prisma.memberRole.createMany({
        data: roleIds.map((roleId) => ({ memberId: member.id, roleId })),
      });
    }
    return this.prisma.memberRole.findMany({
      where: { memberId: member.id },
      include: { role: true },
    });
  }

  async getMemberPermissionCodes(organizationId: string, userId: string): Promise<string[]> {
    await this.ensureSeeded(organizationId, userId);
    const member = await this.prisma.organizationMember.findUnique({
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

    // Org OWNER/ADMIN always get all permissions as fallback
    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      const all = await this.prisma.permission.findMany({ where: { organizationId } });
      return all.map((p) => p.code);
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
  }> {
    await this.ensureSeeded(organizationId, userId);
    const permissions = await this.getMemberPermissionCodes(organizationId, userId);
    const permissionSet = new Set(permissions);

    const member = await this.prisma.organizationMember.findUnique({
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
      const allMenus = await this.prisma.menu.findMany({
        where: { organizationId, isActive: true },
      });
      allMenus.forEach((m) => allowedMenuIds.add(m.id));
    } else {
      for (const mr of member?.memberRoles ?? []) {
        mr.role.roleMenus.forEach((rm) => allowedMenuIds.add(rm.menuId));
        const landing = mr.role.landingPages.find((l) => l.isActive);
        if (landing) landingPath = landing.path;
      }
    }

    const groups = await this.prisma.menuGroup.findMany({
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

    const mapMenu = (m: (typeof groups)[0]['menus'][0]): SidebarMenuDto | null => {
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

    const sidebarGroups: SidebarGroupDto[] = groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        code: g.code,
        sortOrder: g.sortOrder,
        menus: g.menus.map(mapMenu).filter(Boolean) as SidebarMenuDto[],
      }))
      .filter((g) => g.menus.length > 0);

    return { groups: sidebarGroups, permissions, landingPath };
  }

  private async ensureRole(organizationId: string, roleId: string) {
    const role = await this.prisma.iamRole.findFirst({ where: { id: roleId, organizationId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
