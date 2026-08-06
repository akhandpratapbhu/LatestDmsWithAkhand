import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type SearchHit = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  path?: string;
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async universal(
    organizationId: string,
    query: string,
    scope = 'ALL',
    limit = 20,
    types?: string[],
  ) {
    const q = query.trim();
    if (!q) {
      return { query: q, total: 0, results: [] as SearchHit[] };
    }

    const allowed = new Set(
      (types?.length ? types : scope === 'ALL' ? ['USER', 'FORM', 'GRID', 'BRANCH', 'DEPARTMENT', 'DASHBOARD', 'TEAM'] : [scope]).map(
        (t) => t.toUpperCase(),
      ),
    );

    const results: SearchHit[] = [];
    const take = Math.min(Math.max(limit, 1), 50);

    if (allowed.has('USER')) {
      const members = await this.prisma.organizationMember.findMany({
        where: {
          organizationId,
          OR: [
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { user: { firstName: { contains: q, mode: 'insensitive' } } },
            { user: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take,
        include: { user: true },
      });
      for (const m of members) {
        results.push({
          type: 'USER',
          id: m.userId,
          title: `${m.user.firstName} ${m.user.lastName}`,
          subtitle: m.user.email,
          path: '/app/users',
        });
      }
    }

    if (allowed.has('FORM')) {
      const forms = await this.prisma.dynamicForm.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const f of forms) {
        results.push({
          type: 'FORM',
          id: f.id,
          title: f.name,
          subtitle: f.code,
          path: '/app/forms',
        });
      }
    }

    if (allowed.has('GRID')) {
      const grids = await this.prisma.dynamicGrid.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const g of grids) {
        results.push({
          type: 'GRID',
          id: g.id,
          title: g.name,
          subtitle: g.code,
          path: '/app/grids',
        });
      }
    }

    if (allowed.has('BRANCH')) {
      const branches = await this.prisma.branch.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const b of branches) {
        results.push({
          type: 'BRANCH',
          id: b.id,
          title: b.name,
          subtitle: b.code,
          path: '/app/organization',
        });
      }
    }

    if (allowed.has('DEPARTMENT')) {
      const deps = await this.prisma.department.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const d of deps) {
        results.push({
          type: 'DEPARTMENT',
          id: d.id,
          title: d.name,
          subtitle: d.code,
          path: '/app/organization',
        });
      }
    }

    if (allowed.has('TEAM')) {
      const teams = await this.prisma.team.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const t of teams) {
        results.push({
          type: 'TEAM',
          id: t.id,
          title: t.name,
          subtitle: t.code,
          path: '/app/organization',
        });
      }
    }

    if (allowed.has('DASHBOARD')) {
      const dashboards = await this.prisma.dashboard.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take,
      });
      for (const d of dashboards) {
        results.push({
          type: 'DASHBOARD',
          id: d.id,
          title: d.name,
          subtitle: d.slug,
          path: '/app/dashboards',
        });
      }
    }

    return {
      query: q,
      total: results.length,
      results: results.slice(0, take),
    };
  }

  listSaved(organizationId: string, userId: string) {
    return this.prisma.savedSearch.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { isShared: true }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  save(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      query: string;
      scope?: string;
      filters?: Record<string, unknown>;
      isShared?: boolean;
    },
  ) {
    return this.prisma.savedSearch.create({
      data: {
        organizationId,
        userId,
        name: data.name,
        query: data.query,
        scope: data.scope ?? 'ALL',
        filters: (data.filters ?? {}) as Prisma.InputJsonValue,
        isShared: data.isShared ?? false,
      },
    });
  }

  async updateSaved(
    organizationId: string,
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      query: string;
      scope: string;
      filters: Record<string, unknown>;
      isShared: boolean;
    }>,
  ) {
    const existing = await this.prisma.savedSearch.findFirst({
      where: { id, organizationId, userId },
    });
    if (!existing) throw new NotFoundException('Saved search not found');
    return this.prisma.savedSearch.update({
      where: { id },
      data: {
        name: data.name,
        query: data.query,
        scope: data.scope,
        filters: data.filters as Prisma.InputJsonValue | undefined,
        isShared: data.isShared,
      },
    });
  }

  async deleteSaved(organizationId: string, userId: string, id: string) {
    const existing = await this.prisma.savedSearch.findFirst({
      where: { id, organizationId, userId },
    });
    if (!existing) throw new NotFoundException('Saved search not found');
    await this.prisma.savedSearch.delete({ where: { id } });
    return { message: 'Saved search deleted' };
  }
}
