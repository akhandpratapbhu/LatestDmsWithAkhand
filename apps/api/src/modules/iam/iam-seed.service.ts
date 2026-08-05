import { Injectable } from '@nestjs/common';
import { PermissionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SeedPerm = {
  code: string;
  name: string;
  type: PermissionType;
  resource?: string;
  action?: string;
};

const DEFAULT_PERMISSIONS: SeedPerm[] = [
  { code: 'menu.overview', name: 'Dashboard menu', type: 'MENU' },
  { code: 'menu.organization', name: 'Projects menu', type: 'MENU' },
  { code: 'menu.users', name: 'Users menu', type: 'MENU' },
  { code: 'menu.iam', name: 'IAM menu', type: 'MENU' },
  { code: 'menu.dashboards', name: 'Reports menu', type: 'MENU' },
  { code: 'menu.forms', name: 'Forms menu', type: 'MENU' },
  { code: 'menu.grids', name: 'Grids menu', type: 'MENU' },
  { code: 'menu.menus', name: 'Menus menu', type: 'MENU' },
  { code: 'menu.notifications', name: 'Notifications menu', type: 'MENU' },
  { code: 'menu.search', name: 'Search menu', type: 'MENU' },
  { code: 'menu.activity', name: 'Activity menu', type: 'MENU' },
  { code: 'menu.audit', name: 'Audit menu', type: 'MENU' },
  { code: 'menu.masters', name: 'Database menu', type: 'MENU' },
  { code: 'menu.chat', name: 'Chat menu', type: 'MENU' },
  { code: 'menu.calls', name: 'Calls menu', type: 'MENU' },
  { code: 'menu.profile', name: 'Profile menu', type: 'MENU' },
  { code: 'menu.sessions', name: 'Sessions menu', type: 'MENU' },
  { code: 'screen.organization', name: 'Projects screen', type: 'SCREEN', resource: 'organization', action: 'view' },
  { code: 'screen.users', name: 'Users screen', type: 'SCREEN', resource: 'users', action: 'view' },
  { code: 'screen.iam', name: 'IAM screen', type: 'SCREEN', resource: 'iam', action: 'manage' },
  { code: 'screen.dashboards', name: 'Reports builder', type: 'SCREEN', resource: 'dashboards', action: 'manage' },
  { code: 'screen.forms', name: 'Form builder', type: 'SCREEN', resource: 'forms', action: 'manage' },
  { code: 'screen.grids', name: 'Grid builder', type: 'SCREEN', resource: 'grids', action: 'manage' },
  { code: 'screen.menus', name: 'Menu builder', type: 'SCREEN', resource: 'menus', action: 'manage' },
  { code: 'screen.notifications', name: 'Notifications screen', type: 'SCREEN', resource: 'notifications', action: 'manage' },
  { code: 'screen.search', name: 'Search screen', type: 'SCREEN', resource: 'search', action: 'use' },
  { code: 'screen.activity', name: 'Activity screen', type: 'SCREEN', resource: 'activity', action: 'view' },
  { code: 'screen.audit', name: 'Audit screen', type: 'SCREEN', resource: 'audit', action: 'view' },
  { code: 'screen.masters', name: 'Database screen', type: 'SCREEN', resource: 'masters', action: 'manage' },
  { code: 'screen.chat', name: 'Chat screen', type: 'SCREEN', resource: 'chat', action: 'use' },
  { code: 'screen.calls', name: 'Calls screen', type: 'SCREEN', resource: 'calls', action: 'use' },
  { code: 'api.users.write', name: 'Manage users API', type: 'API', resource: 'users', action: 'write' },
  { code: 'api.iam.write', name: 'Manage IAM API', type: 'API', resource: 'iam', action: 'write' },
  { code: 'api.dashboards.write', name: 'Manage dashboards API', type: 'API', resource: 'dashboards', action: 'write' },
  { code: 'api.forms.write', name: 'Manage forms API', type: 'API', resource: 'forms', action: 'write' },
  { code: 'api.grids.write', name: 'Manage grids API', type: 'API', resource: 'grids', action: 'write' },
  { code: 'api.notifications.write', name: 'Send notifications API', type: 'API', resource: 'notifications', action: 'write' },
  { code: 'api.masters.write', name: 'Manage masters API', type: 'API', resource: 'masters', action: 'write' },
  { code: 'data.users.all', name: 'View all users data', type: 'DATA', resource: 'users', action: 'read_all' },
  { code: 'data.users.own', name: 'View own profile data', type: 'DATA', resource: 'users', action: 'read_own' },
];

@Injectable()
export class IamSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seedOrganization(organizationId: string, ownerMemberId: string): Promise<void> {
    const existing = await this.prisma.iamRole.findFirst({ where: { organizationId } });
    if (existing) return;

    await this.prisma.$transaction(async (tx) => {
      for (const p of DEFAULT_PERMISSIONS) {
        await tx.permission.create({
          data: {
            organizationId,
            code: p.code,
            name: p.name,
            type: p.type,
            resource: p.resource,
            action: p.action,
          },
        });
      }

      const perms = await tx.permission.findMany({ where: { organizationId } });
      const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id]));

      const adminRole = await tx.iamRole.create({
        data: {
          organizationId,
          name: 'Administrator',
          code: 'ADMIN',
          description: 'Full access',
          isSystem: true,
        },
      });
      const memberRole = await tx.iamRole.create({
        data: {
          organizationId,
          name: 'Member',
          code: 'MEMBER',
          description: 'Limited access',
          isSystem: true,
        },
      });

      await tx.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      });
      const memberPermCodes = [
        'menu.overview',
        'menu.profile',
        'menu.sessions',
        'menu.notifications',
        'menu.search',
        'menu.activity',
        'menu.chat',
        'menu.calls',
        'screen.notifications',
        'screen.search',
        'screen.activity',
        'screen.chat',
        'screen.calls',
        'data.users.own',
      ];
      await tx.rolePermission.createMany({
        data: memberPermCodes
          .filter((c) => byCode[c])
          .map((c) => ({ roleId: memberRole.id, permissionId: byCode[c] })),
      });

      const mainGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Workspace', code: 'MAIN', sortOrder: 1 },
      });
      const accessGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Access Control', code: 'ACCESS', sortOrder: 2 },
      });
      const configGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Configuration', code: 'CONFIG', sortOrder: 3 },
      });
      const governanceGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Governance / Compliance', code: 'GOVERNANCE', sortOrder: 4 },
      });

      const menuDefs: Array<{
        label: string;
        path: string;
        icon: string;
        groupId: string;
        permissionCode: string;
        sortOrder: number;
        isActive?: boolean;
      }> = [
        // Platform
        { label: 'Dashboard', path: '/app', icon: 'home', groupId: mainGroup.id, permissionCode: 'menu.overview', sortOrder: 1 },
        { label: 'Projects', path: '/app/projects', icon: 'building', groupId: accessGroup.id, permissionCode: 'menu.organization', sortOrder: 1 },
        { label: 'Features', path: '/app/features', icon: 'form', groupId: configGroup.id, permissionCode: 'menu.forms', sortOrder: 0 },
        { label: 'Users', path: '/app/users', icon: 'users', groupId: accessGroup.id, permissionCode: 'menu.users', sortOrder: 2 },
        { label: 'Identity & Access', path: '/app/iam', icon: 'key', groupId: accessGroup.id, permissionCode: 'menu.iam', sortOrder: 3 },
        // Builders / Configuration
        { label: 'Forms', path: '/app/forms', icon: 'form', groupId: configGroup.id, permissionCode: 'menu.forms', sortOrder: 2 },
        { label: 'Menus', path: '/app/menus', icon: 'menu', groupId: configGroup.id, permissionCode: 'menu.menus', sortOrder: 3 },
        { label: 'Grids', path: '/app/grids', icon: 'table', groupId: configGroup.id, permissionCode: 'menu.grids', sortOrder: 4 },
        { label: 'Dashboard Builder', path: '/app/dashboards', icon: 'layout', groupId: configGroup.id, permissionCode: 'menu.dashboards', sortOrder: 5 },
        // Workspace (nested until later product focus)
        { label: 'Sessions', path: '/app/sessions', icon: 'shield', groupId: mainGroup.id, permissionCode: 'menu.sessions', sortOrder: 2 },
        { label: 'Chat', path: '/app/chat', icon: 'chat', groupId: mainGroup.id, permissionCode: 'menu.chat', sortOrder: 3 },
        { label: 'Calls history', path: '/app/calls', icon: 'phone', groupId: mainGroup.id, permissionCode: 'menu.calls', sortOrder: 4 },
        { label: 'Activity', path: '/app/activity', icon: 'activity', groupId: mainGroup.id, permissionCode: 'menu.activity', sortOrder: 5 },
        // Governance
        { label: 'Audit', path: '/app/audit', icon: 'audit', groupId: governanceGroup.id, permissionCode: 'menu.audit', sortOrder: 1 },
        // Header-only (kept for permissions / deep links, hidden from sidebar)
        { label: 'Search', path: '/app/search', icon: 'search', groupId: mainGroup.id, permissionCode: 'menu.search', sortOrder: 90, isActive: false },
        { label: 'Notifications', path: '/app/notifications', icon: 'bell', groupId: mainGroup.id, permissionCode: 'menu.notifications', sortOrder: 91, isActive: false },
        { label: 'Profile', path: '/app/profile', icon: 'user', groupId: mainGroup.id, permissionCode: 'menu.profile', sortOrder: 92, isActive: false },
      ];

      const createdMenus = [];
      for (const m of menuDefs) {
        const menu = await tx.menu.create({
          data: {
            organizationId,
            groupId: m.groupId,
            label: m.label,
            path: m.path,
            icon: m.icon,
            sortOrder: m.sortOrder,
            isActive: m.isActive ?? true,
            permissionId: byCode[m.permissionCode],
          },
        });
        createdMenus.push(menu);
      }

      await tx.roleMenu.createMany({
        data: createdMenus.map((m) => ({ roleId: adminRole.id, menuId: m.id })),
      });
      const memberMenus = createdMenus.filter((m) =>
        ['/app', '/app/sessions', '/app/activity', '/app/chat', '/app/calls', '/app/profile', '/app/notifications', '/app/search'].includes(
          m.path ?? '',
        ),
      );
      await tx.roleMenu.createMany({
        data: memberMenus.map((m) => ({ roleId: memberRole.id, menuId: m.id })),
      });

      await tx.memberRole.create({
        data: { memberId: ownerMemberId, roleId: adminRole.id },
      });

      const adminDashboard = await tx.dashboard.create({
        data: {
          organizationId,
          roleId: adminRole.id,
          name: 'Admin Dashboard',
          slug: 'admin-home',
          description: 'Default dashboard for administrators',
          isDefault: true,
          isLanding: true,
          widgets: {
            create: [
              {
                type: 'CARD',
                title: 'Users',
                config: { metric: 'users', valueLabel: 'Active users' } as Prisma.InputJsonValue,
                sortOrder: 1,
                posX: 0,
                posY: 0,
                width: 3,
                height: 2,
              },
              {
                type: 'CARD',
                title: 'Branches',
                config: { metric: 'branches', valueLabel: 'Branches' } as Prisma.InputJsonValue,
                sortOrder: 2,
                posX: 3,
                posY: 0,
                width: 3,
                height: 2,
              },
              {
                type: 'CHART',
                title: 'Activity',
                config: {
                  chartType: 'bar',
                  series: [
                    { label: 'Mon', value: 12 },
                    { label: 'Tue', value: 18 },
                    { label: 'Wed', value: 9 },
                    { label: 'Thu', value: 22 },
                    { label: 'Fri', value: 15 },
                  ],
                } as Prisma.InputJsonValue,
                sortOrder: 3,
                posX: 0,
                posY: 2,
                width: 6,
                height: 3,
              },
            ],
          },
        },
      });

      const memberDashboard = await tx.dashboard.create({
        data: {
          organizationId,
          roleId: memberRole.id,
          name: 'Member Dashboard',
          slug: 'member-home',
          description: 'Default dashboard for members',
          isDefault: true,
          isLanding: true,
          widgets: {
            create: [
              {
                type: 'CARD',
                title: 'Welcome',
                config: { metric: 'welcome', valueLabel: 'Your workspace' } as Prisma.InputJsonValue,
                sortOrder: 1,
                width: 4,
                height: 2,
              },
              {
                type: 'TEXT',
                title: 'Getting started',
                config: {
                  body: 'You can update your profile and review active sessions from the sidebar.',
                } as Prisma.InputJsonValue,
                sortOrder: 2,
                posX: 4,
                width: 4,
                height: 2,
              },
            ],
          },
        },
      });

      await tx.landingPage.createMany({
        data: [
          {
            organizationId,
            roleId: adminRole.id,
            dashboardId: adminDashboard.id,
            path: '/app',
          },
          {
            organizationId,
            roleId: memberRole.id,
            dashboardId: memberDashboard.id,
            path: '/app',
          },
        ],
      });
    });
  }

  /** Idempotent sidebar IA sync for existing organizations. */
  async syncMenuLayout(organizationId: string): Promise<void> {
    const ensureGroup = async (code: string, name: string, sortOrder: number) => {
      const existing = await this.prisma.menuGroup.findFirst({
        where: { organizationId, code },
      });
      if (existing) {
        return this.prisma.menuGroup.update({
          where: { id: existing.id },
          data: { name, sortOrder, isActive: true },
        });
      }
      return this.prisma.menuGroup.create({
        data: { organizationId, name, code, sortOrder, isActive: true },
      });
    };

    const mainGroup = await ensureGroup('MAIN', 'Workspace', 1);
    const accessGroup = await ensureGroup('ACCESS', 'Access Control', 2);
    const configGroup = await ensureGroup('CONFIG', 'Configuration', 3);
    const governanceGroup = await ensureGroup('GOVERNANCE', 'Governance / Compliance', 4);

    await this.prisma.menuGroup.updateMany({
      where: { organizationId, code: 'ADMIN' },
      data: { isActive: false, name: 'Administration (legacy)', sortOrder: 99 },
    });

    const menuLayout: Array<{
      path: string;
      label: string;
      icon: string;
      permissionCode: string;
      groupId: string;
      sortOrder: number;
      isActive?: boolean;
    }> = [
      { path: '/app', label: 'Dashboard', icon: 'home', permissionCode: 'menu.overview', groupId: mainGroup.id, sortOrder: 1 },
      { path: '/app/projects', label: 'Projects', icon: 'building', permissionCode: 'menu.organization', groupId: accessGroup.id, sortOrder: 1 },
      { path: '/app/features', label: 'Features', icon: 'form', permissionCode: 'menu.forms', groupId: configGroup.id, sortOrder: 0 },
      { path: '/app/users', label: 'Users', icon: 'users', permissionCode: 'menu.users', groupId: accessGroup.id, sortOrder: 2 },
      { path: '/app/iam', label: 'Identity & Access', icon: 'key', permissionCode: 'menu.iam', groupId: accessGroup.id, sortOrder: 3 },
      { path: '/app/forms', label: 'Forms', icon: 'form', permissionCode: 'menu.forms', groupId: configGroup.id, sortOrder: 2 },
      { path: '/app/menus', label: 'Menus', icon: 'menu', permissionCode: 'menu.menus', groupId: configGroup.id, sortOrder: 3 },
      { path: '/app/grids', label: 'Grids', icon: 'table', permissionCode: 'menu.grids', groupId: configGroup.id, sortOrder: 4 },
      { path: '/app/dashboards', label: 'Dashboard Builder', icon: 'layout', permissionCode: 'menu.dashboards', groupId: configGroup.id, sortOrder: 5 },
      { path: '/app/sessions', label: 'Sessions', icon: 'shield', permissionCode: 'menu.sessions', groupId: mainGroup.id, sortOrder: 2 },
      { path: '/app/chat', label: 'Chat', icon: 'chat', permissionCode: 'menu.chat', groupId: mainGroup.id, sortOrder: 3 },
      { path: '/app/calls', label: 'Calls history', icon: 'phone', permissionCode: 'menu.calls', groupId: mainGroup.id, sortOrder: 4 },
      { path: '/app/activity', label: 'Activity', icon: 'activity', permissionCode: 'menu.activity', groupId: mainGroup.id, sortOrder: 5 },
      { path: '/app/audit', label: 'Audit', icon: 'audit', permissionCode: 'menu.audit', groupId: governanceGroup.id, sortOrder: 1 },
      { path: '/app/search', label: 'Search', icon: 'search', permissionCode: 'menu.search', groupId: mainGroup.id, sortOrder: 90, isActive: false },
      { path: '/app/notifications', label: 'Notifications', icon: 'bell', permissionCode: 'menu.notifications', groupId: mainGroup.id, sortOrder: 91, isActive: false },
      { path: '/app/profile', label: 'Profile', icon: 'user', permissionCode: 'menu.profile', groupId: mainGroup.id, sortOrder: 92, isActive: false },
    ];

    const perms = await this.prisma.permission.findMany({ where: { organizationId } });
    const byCode = Object.fromEntries(perms.map((p) => [p.code, p.id]));

    // Ensure menu-builder permissions for older orgs
    if (!byCode['menu.menus']) {
      const created = await this.prisma.permission.create({
        data: {
          organizationId,
          code: 'menu.menus',
          name: 'Menus menu',
          type: 'MENU',
        },
      });
      byCode['menu.menus'] = created.id;
      await this.prisma.permission.create({
        data: {
          organizationId,
          code: 'screen.menus',
          name: 'Menu builder',
          type: 'SCREEN',
          resource: 'menus',
          action: 'manage',
        },
      });
    }

    // Migrate legacy Organization route → Projects
    await this.prisma.menu.updateMany({
      where: { organizationId, path: '/app/organization' },
      data: { path: '/app/projects', label: 'Projects' },
    });

    // Hide removed Masters / Database sidebar entry
    await this.prisma.menu.updateMany({
      where: { organizationId, path: '/app/masters' },
      data: { isActive: false },
    });

    for (const m of menuLayout) {
      const existing = await this.prisma.menu.findFirst({
        where: { organizationId, path: m.path },
      });
      if (existing) {
        await this.prisma.menu.update({
          where: { id: existing.id },
          data: {
            label: m.label,
            icon: m.icon,
            groupId: m.groupId,
            sortOrder: m.sortOrder,
            isActive: m.isActive ?? true,
            permissionId: byCode[m.permissionCode] ?? existing.permissionId,
          },
        });
      } else if (byCode[m.permissionCode]) {
        await this.prisma.menu.create({
          data: {
            organizationId,
            groupId: m.groupId,
            label: m.label,
            path: m.path,
            icon: m.icon,
            sortOrder: m.sortOrder,
            isActive: m.isActive ?? true,
            permissionId: byCode[m.permissionCode],
          },
        });
      }
    }
  }
}
