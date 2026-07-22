import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GridColumnType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type FilterOp = {
  field: string;
  op?: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | number | boolean;
};

type SortOp = { field: string; dir?: 'asc' | 'desc' };

@Injectable()
export class GridsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.dynamicGrid.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        columns: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { rows: true, savedViews: true } },
      },
    });
  }

  async get(organizationId: string, id: string) {
    const grid = await this.prisma.dynamicGrid.findFirst({
      where: { id, organizationId },
      include: {
        columns: { orderBy: { sortOrder: 'asc' } },
        savedViews: { orderBy: { name: 'asc' } },
      },
    });
    if (!grid) throw new NotFoundException('Grid not found');
    return grid;
  }

  create(
    organizationId: string,
    data: {
      name: string;
      code: string;
      description?: string;
      pageSize?: number;
      enableSort?: boolean;
      enableFilter?: boolean;
      enableExport?: boolean;
      enableImport?: boolean;
    },
  ) {
    return this.prisma.dynamicGrid.create({
      data: {
        organizationId,
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        pageSize: data.pageSize ?? 10,
        enableSort: data.enableSort ?? true,
        enableFilter: data.enableFilter ?? true,
        enableExport: data.enableExport ?? true,
        enableImport: data.enableImport ?? true,
      },
      include: { columns: true },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      pageSize: number;
      enableSort: boolean;
      enableFilter: boolean;
      enableExport: boolean;
      enableImport: boolean;
      isActive: boolean;
    }>,
  ) {
    await this.ensureGrid(organizationId, id);
    return this.prisma.dynamicGrid.update({
      where: { id },
      data,
      include: { columns: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async addColumn(
    organizationId: string,
    gridId: string,
    data: {
      fieldKey: string;
      title: string;
      dataType?: GridColumnType;
      sortable?: boolean;
      filterable?: boolean;
      visible?: boolean;
      width?: number;
      sortOrder?: number;
      format?: string;
    },
  ) {
    await this.ensureGrid(organizationId, gridId);
    return this.prisma.gridColumn.create({
      data: {
        gridId,
        fieldKey: data.fieldKey,
        title: data.title,
        dataType: data.dataType ?? 'TEXT',
        sortable: data.sortable ?? true,
        filterable: data.filterable ?? true,
        visible: data.visible ?? true,
        width: data.width,
        sortOrder: data.sortOrder ?? 0,
        format: data.format,
      },
    });
  }

  async updateColumn(
    organizationId: string,
    columnId: string,
    data: Partial<{
      title: string;
      dataType: GridColumnType;
      sortable: boolean;
      filterable: boolean;
      visible: boolean;
      width: number | null;
      sortOrder: number;
      format: string | null;
    }>,
  ) {
    const col = await this.prisma.gridColumn.findUnique({
      where: { id: columnId },
      include: { grid: true },
    });
    if (!col || col.grid.organizationId !== organizationId) {
      throw new NotFoundException('Column not found');
    }
    return this.prisma.gridColumn.update({ where: { id: columnId }, data });
  }

  async query(
    organizationId: string,
    gridId: string,
    input: {
      page?: number;
      pageSize?: number;
      filters?: FilterOp[];
      sorts?: SortOp[];
    },
  ) {
    const grid = await this.get(organizationId, gridId);
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, input.pageSize ?? grid.pageSize));
    const rows = await this.prisma.gridRow.findMany({ where: { gridId } });

    let data: Array<Record<string, unknown> & { id: string }> = rows.map((r) => ({
      id: r.id,
      ...(r.data as Record<string, unknown>),
    }));

    if (grid.enableFilter && input.filters?.length) {
      data = data.filter((row) =>
        input.filters!.every((f) => {
          const cell = row[f.field];
          const op = f.op ?? 'contains';
          if (op === 'eq') return String(cell ?? '') === String(f.value);
          if (op === 'contains')
            return String(cell ?? '')
              .toLowerCase()
              .includes(String(f.value).toLowerCase());
          const n = Number(cell);
          const v = Number(f.value);
          if (op === 'gt') return n > v;
          if (op === 'gte') return n >= v;
          if (op === 'lt') return n < v;
          if (op === 'lte') return n <= v;
          return true;
        }),
      );
    }

    if (grid.enableSort && input.sorts?.length) {
      for (const sort of [...input.sorts].reverse()) {
        const dir = sort.dir === 'desc' ? -1 : 1;
        data.sort((a, b) => {
          const av = a[sort.field];
          const bv = b[sort.field];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
          return String(av).localeCompare(String(bv)) * dir;
        });
      }
    }

    const total = data.length;
    const start = (page - 1) * pageSize;
    const items = data.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      columns: grid.columns.filter((c) => c.visible),
    };
  }

  async importRows(
    organizationId: string,
    gridId: string,
    rows: Array<Record<string, unknown>>,
  ) {
    const grid = await this.get(organizationId, gridId);
    if (!grid.enableImport) throw new BadRequestException('Import disabled for this grid');
    if (!rows?.length) throw new BadRequestException('No rows to import');

    await this.prisma.gridRow.createMany({
      data: rows.map((data) => ({
        gridId,
        data: data as Prisma.InputJsonValue,
      })),
    });
    return { message: `Imported ${rows.length} rows`, count: rows.length };
  }

  async exportRows(
    organizationId: string,
    gridId: string,
    input: { filters?: FilterOp[]; sorts?: SortOp[] },
  ) {
    const grid = await this.get(organizationId, gridId);
    if (!grid.enableExport) throw new BadRequestException('Export disabled for this grid');
    const result = await this.query(organizationId, gridId, {
      page: 1,
      pageSize: 10000,
      filters: input.filters,
      sorts: input.sorts,
    });
    return {
      grid: { id: grid.id, name: grid.name, code: grid.code },
      columns: result.columns.map((c) => ({ fieldKey: c.fieldKey, title: c.title })),
      rows: result.items,
    };
  }

  async saveView(
    organizationId: string,
    gridId: string,
    userId: string,
    data: {
      name: string;
      filters?: unknown[];
      sorts?: unknown[];
      columns?: unknown[];
      isDefault?: boolean;
      isShared?: boolean;
    },
  ) {
    await this.ensureGrid(organizationId, gridId);
    if (data.isDefault) {
      await this.prisma.gridSavedView.updateMany({
        where: { gridId, userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.gridSavedView.create({
      data: {
        gridId,
        userId,
        name: data.name,
        filters: (data.filters ?? []) as Prisma.InputJsonValue,
        sorts: (data.sorts ?? []) as Prisma.InputJsonValue,
        columns: (data.columns ?? []) as Prisma.InputJsonValue,
        isDefault: data.isDefault ?? false,
        isShared: data.isShared ?? false,
      },
    });
  }

  listViews(organizationId: string, gridId: string, userId: string) {
    return this.prisma.gridSavedView.findMany({
      where: {
        gridId,
        grid: { organizationId },
        OR: [{ userId }, { isShared: true }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  private async ensureGrid(organizationId: string, id: string) {
    const grid = await this.prisma.dynamicGrid.findFirst({ where: { id, organizationId } });
    if (!grid) throw new NotFoundException('Grid not found');
    return grid;
  }
}
