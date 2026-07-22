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
  { code: 'menu.overview', name: 'Overview menu', type: 'MENU' },
  { code: 'menu.organization', name: 'Organization menu', type: 'MENU' },
  { code: 'menu.users', name: 'Users menu', type: 'MENU' },
  { code: 'menu.iam', name: 'IAM menu', type: 'MENU' },
  { code: 'menu.dashboards', name: 'Dashboards menu', type: 'MENU' },
  { code: 'menu.forms', name: 'Forms menu', type: 'MENU' },
  { code: 'menu.grids', name: 'Grids menu', type: 'MENU' },
  { code: 'menu.profile', name: 'Profile menu', type: 'MENU' },
  { code: 'menu.sessions', name: 'Sessions menu', type: 'MENU' },
  { code: 'screen.organization', name: 'Organization screen', type: 'SCREEN', resource: 'organization', action: 'view' },
  { code: 'screen.users', name: 'Users screen', type: 'SCREEN', resource: 'users', action: 'view' },
  { code: 'screen.iam', name: 'IAM screen', type: 'SCREEN', resource: 'iam', action: 'manage' },
  { code: 'screen.dashboards', name: 'Dashboard builder', type: 'SCREEN', resource: 'dashboards', action: 'manage' },
  { code: 'screen.forms', name: 'Form builder', type: 'SCREEN', resource: 'forms', action: 'manage' },
  { code: 'screen.grids', name: 'Grid builder', type: 'SCREEN', resource: 'grids', action: 'manage' },
  { code: 'api.users.write', name: 'Manage users API', type: 'API', resource: 'users', action: 'write' },
  { code: 'api.iam.write', name: 'Manage IAM API', type: 'API', resource: 'iam', action: 'write' },
  { code: 'api.dashboards.write', name: 'Manage dashboards API', type: 'API', resource: 'dashboards', action: 'write' },
  { code: 'api.forms.write', name: 'Manage forms API', type: 'API', resource: 'forms', action: 'write' },
  { code: 'api.grids.write', name: 'Manage grids API', type: 'API', resource: 'grids', action: 'write' },
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
        'data.users.own',
      ];
      await tx.rolePermission.createMany({
        data: memberPermCodes
          .filter((c) => byCode[c])
          .map((c) => ({ roleId: memberRole.id, permissionId: byCode[c] })),
      });

      const mainGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Main', code: 'MAIN', sortOrder: 1 },
      });
      const adminGroup = await tx.menuGroup.create({
        data: { organizationId, name: 'Administration', code: 'ADMIN', sortOrder: 2 },
      });

      const menuDefs: Array<{
        label: string;
        path: string;
        icon: string;
        groupId: string;
        permissionCode: string;
        sortOrder: number;
      }> = [
        { label: 'Overview', path: '/app', icon: 'home', groupId: mainGroup.id, permissionCode: 'menu.overview', sortOrder: 1 },
        { label: 'Profile', path: '/app/profile', icon: 'user', groupId: mainGroup.id, permissionCode: 'menu.profile', sortOrder: 2 },
        { label: 'Sessions', path: '/app/sessions', icon: 'shield', groupId: mainGroup.id, permissionCode: 'menu.sessions', sortOrder: 3 },
        { label: 'Organization', path: '/app/organization', icon: 'building', groupId: adminGroup.id, permissionCode: 'menu.organization', sortOrder: 1 },
        { label: 'Users', path: '/app/users', icon: 'users', groupId: adminGroup.id, permissionCode: 'menu.users', sortOrder: 2 },
        { label: 'IAM', path: '/app/iam', icon: 'key', groupId: adminGroup.id, permissionCode: 'menu.iam', sortOrder: 3 },
        { label: 'Dashboards', path: '/app/dashboards', icon: 'layout', groupId: adminGroup.id, permissionCode: 'menu.dashboards', sortOrder: 4 },
        { label: 'Forms', path: '/app/forms', icon: 'form', groupId: adminGroup.id, permissionCode: 'menu.forms', sortOrder: 5 },
        { label: 'Grids', path: '/app/grids', icon: 'table', groupId: adminGroup.id, permissionCode: 'menu.grids', sortOrder: 6 },
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
            permissionId: byCode[m.permissionCode],
          },
        });
        createdMenus.push(menu);
      }

      await tx.roleMenu.createMany({
        data: createdMenus.map((m) => ({ roleId: adminRole.id, menuId: m.id })),
      });
      const memberMenus = createdMenus.filter((m) =>
        ['/app', '/app/profile', '/app/sessions'].includes(m.path ?? ''),
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
}
