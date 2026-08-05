import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WidgetType } from '@prisma/client';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { IamService } from '../iam/iam.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any;

/** Prefer domain roles when a user has multiple landings. */
const ROLE_LANDING_PRIORITY = [
  'DOCTOR',
  'PATIENT',
  'TEACHER',
  'STUDENT',
  'NURSE',
  'RECEPTIONIST',
  'PRINCIPAL',
  'HOSPITAL_ADMIN',
  'SCHOOL_ADMIN',
  'ADMIN',
  'MANAGER',
  'MEMBER',
];

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDbService,
    private readonly iam: IamService,
  ) {}

  private async resolveDb(organizationId: string): Promise<TenantDb> {
    const project = await this.projectDb.getClient(organizationId);
    if (project) return project as ProjectPrismaClient;
    return this.prisma;
  }

  async list(organizationId: string) {
    const db = await this.resolveDb(organizationId);
    return db.dashboard.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      include: {
        role: true,
        widgets: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { widgets: true } },
      },
    });
  }

  async getOne(organizationId: string, id: string) {
    const db = await this.resolveDb(organizationId);
    const row = await db.dashboard.findFirst({
      where: { id, organizationId },
      include: {
        role: true,
        widgets: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Dashboard not found');
    return row;
  }

  async getMine(organizationId: string, userId: string) {
    await this.iam.ensureSeeded(organizationId, userId);
    const db = await this.resolveDb(organizationId);
    const member = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: {
        memberRoles: { include: { role: true } },
      },
    });
    if (!member) throw new NotFoundException('Membership not found');

    const roleIds = member.memberRoles.map((m: { roleId: string }) => m.roleId);
    const roleCodes = new Map<string, string>(
      member.memberRoles.map((m: { roleId: string; role: { code: string } }) => [
        m.roleId,
        m.role.code,
      ]),
    );

    if (member.role === 'OWNER' || member.role === 'ADMIN') {
      for (const code of ['HOSPITAL_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'PRINCIPAL']) {
        const adminRole = await db.iamRole.findFirst({
          where: { organizationId, code },
        });
        if (adminRole && !roleIds.includes(adminRole.id)) {
          roleIds.push(adminRole.id);
          roleCodes.set(adminRole.id, adminRole.code);
        }
      }
    }

    const landings = await db.landingPage.findMany({
      where: {
        organizationId,
        isActive: true,
        roleId: { in: roleIds.length ? roleIds : ['__none__'] },
      },
      include: {
        dashboard: {
          include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
        },
        role: true,
      },
    });

    if (landings.length) {
      landings.sort((a: { roleId: string }, b: { roleId: string }) => {
        const ca = roleCodes.get(a.roleId) ?? '';
        const cb = roleCodes.get(b.roleId) ?? '';
        const ia = ROLE_LANDING_PRIORITY.indexOf(ca);
        const ib = ROLE_LANDING_PRIORITY.indexOf(cb);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      const landing = landings[0];
      return {
        landingPath: landing.path,
        dashboard: landing.dashboard,
        role: landing.dashboard.role,
      };
    }

    const fallback = await db.dashboard.findFirst({
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
    const db = await this.resolveDb(organizationId);
    const created = await db.dashboard.create({
      data: {
        organizationId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        roleId: data.roleId,
        isDefault: data.isDefault ?? false,
        isLanding: data.isLanding ?? Boolean(data.roleId),
      },
      include: { widgets: true, role: true },
    });

    if (data.roleId) {
      await this.setLanding(organizationId, {
        roleId: data.roleId,
        dashboardId: created.id,
        path: '/app',
      });
    }

    return created;
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
    const db = await this.resolveDb(organizationId);
    const updated = await db.dashboard.update({
      where: { id },
      data,
      include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
    });

    if (data.roleId) {
      await this.setLanding(organizationId, {
        roleId: data.roleId,
        dashboardId: id,
        path: '/app',
      });
    }

    return updated;
  }

  /**
   * Upsert the primary dashboard for a (project, role) pair.
   * Replaces widgets when provided; always sets LandingPage.
   */
  async upsertForRole(
    organizationId: string,
    data: {
      roleId: string;
      name: string;
      slug: string;
      description?: string;
      widgets?: Array<{
        type: WidgetType;
        title: string;
        config?: Record<string, unknown>;
        sortOrder?: number;
        posX?: number;
        posY?: number;
        width?: number;
        height?: number;
      }>;
    },
  ) {
    const db = await this.resolveDb(organizationId);
    const existing = await db.dashboard.findFirst({
      where: { organizationId, roleId: data.roleId, isActive: true },
      orderBy: [{ isLanding: 'desc' }, { updatedAt: 'desc' }],
    });

    let dashboardId: string;
    if (existing) {
      if (data.widgets) {
        await db.widget.deleteMany({ where: { dashboardId: existing.id } });
      }
      const updated = await db.dashboard.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          isLanding: true,
          isDefault: true,
          isActive: true,
          ...(data.widgets
            ? {
                widgets: {
                  create: data.widgets.map((w, i) => ({
                    type: w.type,
                    title: w.title,
                    config: (w.config ?? {}) as Prisma.InputJsonValue,
                    sortOrder: w.sortOrder ?? i,
                    posX: w.posX ?? 0,
                    posY: w.posY ?? 0,
                    width: w.width ?? 4,
                    height: w.height ?? 2,
                  })),
                },
              }
            : {}),
        },
        include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
      });
      dashboardId = updated.id;
      await this.setLanding(organizationId, {
        roleId: data.roleId,
        dashboardId,
        path: '/app',
      });
      return updated;
    }

    const bySlug = await db.dashboard.findUnique({
      where: { organizationId_slug: { organizationId, slug: data.slug } },
    });
    if (bySlug) {
      if (data.widgets) {
        await db.widget.deleteMany({ where: { dashboardId: bySlug.id } });
      }
      const updated = await db.dashboard.update({
        where: { id: bySlug.id },
        data: {
          name: data.name,
          description: data.description,
          roleId: data.roleId,
          isLanding: true,
          isDefault: true,
          isActive: true,
          ...(data.widgets
            ? {
                widgets: {
                  create: data.widgets.map((w, i) => ({
                    type: w.type,
                    title: w.title,
                    config: (w.config ?? {}) as Prisma.InputJsonValue,
                    sortOrder: w.sortOrder ?? i,
                    posX: w.posX ?? 0,
                    posY: w.posY ?? 0,
                    width: w.width ?? 4,
                    height: w.height ?? 2,
                  })),
                },
              }
            : {}),
        },
        include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
      });
      await this.setLanding(organizationId, {
        roleId: data.roleId,
        dashboardId: updated.id,
        path: '/app',
      });
      return updated;
    }

    const created = await db.dashboard.create({
      data: {
        organizationId,
        roleId: data.roleId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        isDefault: true,
        isLanding: true,
        widgets: data.widgets
          ? {
              create: data.widgets.map((w, i) => ({
                type: w.type,
                title: w.title,
                config: (w.config ?? {}) as Prisma.InputJsonValue,
                sortOrder: w.sortOrder ?? i,
                posX: w.posX ?? 0,
                posY: w.posY ?? 0,
                width: w.width ?? 4,
                height: w.height ?? 2,
              })),
            }
          : undefined,
      },
      include: { widgets: { orderBy: { sortOrder: 'asc' } }, role: true },
    });
    await this.setLanding(organizationId, {
      roleId: data.roleId,
      dashboardId: created.id,
      path: '/app',
    });
    return created;
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
    const db = await this.resolveDb(organizationId);
    return db.widget.create({
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
    const db = await this.resolveDb(organizationId);
    const widget = await db.widget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });
    if (!widget || widget.dashboard.organizationId !== organizationId) {
      throw new NotFoundException('Widget not found');
    }
    return db.widget.update({
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
    const db = await this.resolveDb(organizationId);
    const widget = await db.widget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });
    if (!widget || widget.dashboard.organizationId !== organizationId) {
      throw new NotFoundException('Widget not found');
    }
    await db.widget.delete({ where: { id: widgetId } });
    return { message: 'Widget deleted' };
  }

  async setLanding(
    organizationId: string,
    data: { roleId: string; dashboardId: string; path?: string },
  ) {
    await this.ensureDashboard(organizationId, data.dashboardId);
    const db = await this.resolveDb(organizationId);
    return db.landingPage.upsert({
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
    const db = await this.resolveDb(organizationId);
    return db.landingPage.findMany({
      where: { organizationId },
      include: { role: true, dashboard: true },
    });
  }

  private async ensureDashboard(organizationId: string, id: string) {
    const db = await this.resolveDb(organizationId);
    const row = await db.dashboard.findFirst({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Dashboard not found');
    return row;
  }
}
