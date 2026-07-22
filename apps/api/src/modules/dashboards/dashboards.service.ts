import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WidgetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IamService } from '../iam/iam.service';

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iam: IamService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.dashboard.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        role: true,
        widgets: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { widgets: true } },
      },
    });
  }

  async getMine(organizationId: string, userId: string) {
    await this.iam.ensureSeeded(organizationId, userId);
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: { include: { role: true } },
      },
    });
    if (!member) throw new NotFoundException('Membership not found');

    const roleIds = member.memberRoles.map((m) => m.roleId);
    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      const adminRole = await this.prisma.iamRole.findFirst({
        where: { organizationId, code: 'ADMIN' },
      });
      if (adminRole) roleIds.push(adminRole.id);
    }

    const landing = await this.prisma.landingPage.findFirst({
      where: {
        organizationId,
        isActive: true,
        roleId: { in: roleIds.length ? roleIds : ['__none__'] },
      },
      include: {
        dashboard: {
          include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
        },
      },
    });

    if (landing) {
      return {
        landingPath: landing.path,
        dashboard: landing.dashboard,
        role: landing.dashboard.role,
      };
    }

    const fallback = await this.prisma.dashboard.findFirst({
      where: {
        organizationId,
        isActive: true,
        OR: [{ roleId: { in: roleIds } }, { isDefault: true }],
      },
      include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
      orderBy: [{ isLanding: 'desc' }, { isDefault: 'desc' }],
    });

    return {
      landingPath: '/app',
      dashboard: fallback,
      role: fallback?.role ?? null,
    };
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      slug: string;
      description?: string;
      roleId?: string;
      isDefault?: boolean;
      isLanding?: boolean;
    },
  ) {
    return this.prisma.dashboard.create({
      data: {
        organizationId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        roleId: data.roleId,
        isDefault: data.isDefault ?? false,
        isLanding: data.isLanding ?? false,
      },
      include: { widgets: true, role: true },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      roleId: string | null;
      isDefault: boolean;
      isLanding: boolean;
      isActive: boolean;
    }>,
  ) {
    await this.ensureDashboard(organizationId, id);
    return this.prisma.dashboard.update({
      where: { id },
      data,
      include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
    });
  }

  async addWidget(
    organizationId: string,
    dashboardId: string,
    data: {
      type: WidgetType;
      title: string;
      config?: Record<string, unknown>;
      sortOrder?: number;
      posX?: number;
      posY?: number;
      width?: number;
      height?: number;
    },
  ) {
    await this.ensureDashboard(organizationId, dashboardId);
    return this.prisma.widget.create({
      data: {
        dashboardId,
        type: data.type,
        title: data.title,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        sortOrder: data.sortOrder ?? 0,
        posX: data.posX ?? 0,
        posY: data.posY ?? 0,
        width: data.width ?? 4,
        height: data.height ?? 2,
      },
    });
  }

  async updateWidget(
    organizationId: string,
    widgetId: string,
    data: Partial<{
      title: string;
      config: Record<string, unknown>;
      sortOrder: number;
      posX: number;
      posY: number;
      width: number;
      height: number;
    }>,
  ) {
    const widget = await this.prisma.widget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });
    if (!widget || widget.dashboard.organizationId !== organizationId) {
      throw new NotFoundException('Widget not found');
    }
    return this.prisma.widget.update({
      where: { id: widgetId },
      data: {
        title: data.title,
        sortOrder: data.sortOrder,
        posX: data.posX,
        posY: data.posY,
        width: data.width,
        height: data.height,
        ...(data.config ? { config: data.config as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async deleteWidget(organizationId: string, widgetId: string) {
    const widget = await this.prisma.widget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });
    if (!widget || widget.dashboard.organizationId !== organizationId) {
      throw new NotFoundException('Widget not found');
    }
    await this.prisma.widget.delete({ where: { id: widgetId } });
    return { message: 'Widget deleted' };
  }

  async setLanding(
    organizationId: string,
    data: { roleId: string; dashboardId: string; path?: string },
  ) {
    await this.ensureDashboard(organizationId, data.dashboardId);
    return this.prisma.landingPage.upsert({
      where: {
        organizationId_roleId: { organizationId, roleId: data.roleId },
      },
      create: {
        organizationId,
        roleId: data.roleId,
        dashboardId: data.dashboardId,
        path: data.path ?? '/app',
      },
      update: {
        dashboardId: data.dashboardId,
        path: data.path ?? '/app',
        isActive: true,
      },
      include: { dashboard: true, role: true },
    });
  }

  async listLandings(organizationId: string) {
    return this.prisma.landingPage.findMany({
      where: { organizationId },
      include: { role: true, dashboard: true },
    });
  }

  private async ensureDashboard(organizationId: string, id: string) {
    const row = await this.prisma.dashboard.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Dashboard not found');
    return row;
  }
}
