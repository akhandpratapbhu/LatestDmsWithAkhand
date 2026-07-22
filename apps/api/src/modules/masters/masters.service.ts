import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMasterDto, UpdateMasterDto } from './dto/masters.dto';

export const MASTER_ENTITIES = [
  'customers',
  'dealers',
  'employees',
  'vendors',
  'vehicles',
  'parts',
  'products',
  'warehouses',
] as const;

export type MasterEntity = (typeof MASTER_ENTITIES)[number];

export type DirectoryKind = 'CUSTOMER' | 'DEALER' | 'EMPLOYEE' | 'USER';

export type DirectoryContact = {
  kind: DirectoryKind;
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedUserId?: string | null;
  subtitle?: string | null;
};

const ENTITY_FIELDS: Record<MasterEntity, readonly string[]> = {
  customers: [
    'code',
    'name',
    'email',
    'phone',
    'company',
    'city',
    'notes',
    'isActive',
    'linkedUserId',
  ],
  dealers: [
    'code',
    'name',
    'email',
    'phone',
    'company',
    'city',
    'region',
    'notes',
    'isActive',
    'linkedUserId',
  ],
  employees: [
    'code',
    'firstName',
    'lastName',
    'email',
    'phone',
    'designation',
    'department',
    'linkedUserId',
    'isActive',
  ],
  vendors: [
    'code',
    'name',
    'email',
    'phone',
    'company',
    'city',
    'contactPerson',
    'gstNumber',
    'notes',
    'isActive',
  ],
  vehicles: [
    'code',
    'name',
    'make',
    'model',
    'year',
    'vin',
    'registrationNo',
    'color',
    'notes',
    'isActive',
  ],
  parts: [
    'code',
    'name',
    'description',
    'sku',
    'unit',
    'price',
    'category',
    'notes',
    'isActive',
  ],
  products: [
    'code',
    'name',
    'description',
    'sku',
    'unit',
    'price',
    'category',
    'notes',
    'isActive',
  ],
  warehouses: [
    'code',
    'name',
    'address',
    'city',
    'state',
    'country',
    'phone',
    'notes',
    'isActive',
  ],
};

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
};

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  isMasterEntity(value: string): value is MasterEntity {
    return (MASTER_ENTITIES as readonly string[]).includes(value);
  }

  assertEntity(entity: string): MasterEntity {
    if (!this.isMasterEntity(entity)) {
      throw new BadRequestException(
        `Unknown master entity "${entity}". Expected one of: ${MASTER_ENTITIES.join(', ')}`,
      );
    }
    return entity;
  }

  list(organizationId: string, entity: string) {
    const key = this.assertEntity(entity);
    return this.delegate(key).findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(organizationId: string, entity: string, id: string) {
    const key = this.assertEntity(entity);
    const row = await this.delegate(key).findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException(`${this.label(key)} not found`);
    return row;
  }

  async create(organizationId: string, entity: string, dto: CreateMasterDto) {
    const key = this.assertEntity(entity);
    this.validateCreate(key, dto);
    const data = this.pickFields(key, dto);
    data.code = String(data.code).toUpperCase();
    if (data.isActive === undefined) data.isActive = true;
    if (key === 'vehicles' && !data.name) {
      data.name =
        [dto.make, dto.model].filter(Boolean).join(' ') ||
        dto.registrationNo ||
        String(data.code);
    }

    try {
      return await this.delegate(key).create({
        data: { organizationId, ...data },
      });
    } catch (err: unknown) {
      this.rethrowUnique(err, key);
      throw err;
    }
  }

  async update(
    organizationId: string,
    entity: string,
    id: string,
    dto: UpdateMasterDto,
  ) {
    const key = this.assertEntity(entity);
    await this.ensureExists(organizationId, key, id);
    const data = this.pickFields(key, dto);
    if (data.code !== undefined) data.code = String(data.code).toUpperCase();
    if (!Object.keys(data).length) {
      throw new BadRequestException('No valid fields to update');
    }

    try {
      return await this.delegate(key).update({
        where: { id },
        data,
      });
    } catch (err: unknown) {
      this.rethrowUnique(err, key);
      throw err;
    }
  }

  async remove(organizationId: string, entity: string, id: string) {
    const key = this.assertEntity(entity);
    await this.ensureExists(organizationId, key, id);
    // Soft delete preferred
    return this.delegate(key).update({
      where: { id },
      data: { isActive: false },
    });
  }

  async directory(
    organizationId: string,
    kindsParam?: string,
  ): Promise<DirectoryContact[]> {
    const kinds = this.parseKinds(kindsParam);
    const results: DirectoryContact[] = [];

    if (kinds.includes('CUSTOMER')) {
      const rows = await this.prisma.customer.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
        take: 500,
      });
      for (const row of rows) {
        results.push({
          kind: 'CUSTOMER',
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          linkedUserId: row.linkedUserId,
          subtitle: row.company ?? row.city ?? row.code,
        });
      }
    }

    if (kinds.includes('DEALER')) {
      const rows = await this.prisma.dealer.findMany({
        where: { organizationId, isActive: true },
        orderBy: { name: 'asc' },
        take: 500,
      });
      for (const row of rows) {
        results.push({
          kind: 'DEALER',
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          linkedUserId: row.linkedUserId,
          subtitle: row.region ?? row.company ?? row.code,
        });
      }
    }

    if (kinds.includes('EMPLOYEE')) {
      const rows = await this.prisma.employee.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 500,
      });
      for (const row of rows) {
        results.push({
          kind: 'EMPLOYEE',
          id: row.id,
          name: `${row.firstName} ${row.lastName}`.trim(),
          email: row.email,
          phone: row.phone,
          linkedUserId: row.linkedUserId,
          subtitle: row.designation ?? row.department ?? row.code,
        });
      }
    }

    if (kinds.includes('USER')) {
      const members = await this.prisma.organizationMember.findMany({
        where: { organizationId, status: 'ACTIVE', user: { isActive: true } },
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
        take: 500,
      });
      for (const member of members) {
        const u = member.user;
        results.push({
          kind: 'USER',
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          phone: u.phone,
          linkedUserId: u.id,
          subtitle: member.role,
        });
      }
    }

    return results;
  }

  private parseKinds(kindsParam?: string): DirectoryKind[] {
    const allowed: DirectoryKind[] = ['CUSTOMER', 'DEALER', 'EMPLOYEE', 'USER'];
    if (!kindsParam?.trim()) return allowed;
    const parsed = kindsParam
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean) as DirectoryKind[];
    const valid = parsed.filter((k) => allowed.includes(k));
    if (!valid.length) {
      throw new BadRequestException(
        `kinds must be one or more of: ${allowed.join(',')}`,
      );
    }
    return [...new Set(valid)];
  }

  private validateCreate(entity: MasterEntity, dto: CreateMasterDto) {
    if (entity === 'employees') {
      if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
        throw new BadRequestException('firstName and lastName are required');
      }
      return;
    }
    if (entity === 'vehicles') {
      if (!dto.name?.trim() && !dto.registrationNo?.trim() && !dto.make?.trim()) {
        throw new BadRequestException(
          'Provide name, registrationNo, or make for a vehicle',
        );
      }
      return;
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('name is required');
    }
  }

  private pickFields(
    entity: MasterEntity,
    dto: CreateMasterDto | UpdateMasterDto,
  ): Record<string, unknown> {
    const allowed = new Set(ENTITY_FIELDS[entity]);
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (!allowed.has(key) || value === undefined) continue;
      out[key] = value === '' ? null : value;
    }
    return out;
  }

  private async ensureExists(
    organizationId: string,
    entity: MasterEntity,
    id: string,
  ) {
    const row = await this.delegate(entity).findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException(`${this.label(entity)} not found`);
    return row;
  }

  private label(entity: MasterEntity): string {
    return entity.slice(0, -1);
  }

  private rethrowUnique(err: unknown, entity: MasterEntity) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new BadRequestException(
        `A ${this.label(entity)} with this code already exists in the organization`,
      );
    }
  }

  private delegate(entity: MasterEntity): PrismaDelegate {
    switch (entity) {
      case 'customers':
        return this.prisma.customer as unknown as PrismaDelegate;
      case 'dealers':
        return this.prisma.dealer as unknown as PrismaDelegate;
      case 'employees':
        return this.prisma.employee as unknown as PrismaDelegate;
      case 'vendors':
        return this.prisma.vendor as unknown as PrismaDelegate;
      case 'vehicles':
        return this.prisma.vehicle as unknown as PrismaDelegate;
      case 'parts':
        return this.prisma.part as unknown as PrismaDelegate;
      case 'products':
        return this.prisma.product as unknown as PrismaDelegate;
      case 'warehouses':
        return this.prisma.warehouse as unknown as PrismaDelegate;
      default: {
        const _exhaustive: never = entity;
        throw new BadRequestException(`Unsupported entity ${_exhaustive}`);
      }
    }
  }
}
