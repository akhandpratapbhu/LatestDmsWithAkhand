import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { rewriteDatabaseInUrl } from '../project-db/connection-url';
import { ProjectIamSeedService } from '../iam/project-iam-seed.service';

const execFileAsync = promisify(execFile);

export type ProvisionResult =
  | {
      ok: true;
      connectionString: string;
      databaseName: string;
      schemaApplied: boolean;
      seeded: boolean;
    }
  | { ok: false; databaseName: string; warning: string };

/**
 * Physical Postgres provisioning for a new project:
 * 1) CREATE DATABASE
 * 2) prisma db push (project schema)
 * 3) seed IAM + LoginPageConfig + project admin user
 */
@Injectable()
export class ProjectDbProvisioner {
  private readonly logger = new Logger(ProjectDbProvisioner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDbService,
    private readonly projectIamSeed: ProjectIamSeedService,
  ) {}

  async provision(params: {
    databaseName: string;
    organizationId: string;
    owner: {
      id: string;
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      avatarUrl?: string | null;
    };
  }): Promise<ProvisionResult> {
    const { databaseName, organizationId, owner } = params;
    const adminUrl = process.env.DATABASE_URL;
    if (!adminUrl) {
      return {
        ok: false,
        databaseName,
        warning: 'DATABASE_URL is not set; skipped physical database creation.',
      };
    }

    if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)) {
      return {
        ok: false,
        databaseName,
        warning: `Invalid database name "${databaseName}". Use lowercase letters, digits, and underscores.`,
      };
    }

    let connectionString: string;
    try {
      const existing = await this.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '${databaseName}') AS exists`,
      );
      if (!existing[0]?.exists) {
        await this.prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
        this.logger.log(`Created Postgres database "${databaseName}"`);
      } else {
        this.logger.log(`Postgres database "${databaseName}" already exists; reusing`);
      }
      connectionString = rewriteDatabaseInUrl(adminUrl, databaseName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CREATE DATABASE "${databaseName}" failed: ${message}`);
      return {
        ok: false,
        databaseName,
        warning:
          `Could not create Postgres database "${databaseName}" (${message}). ` +
          'Project metadata was saved; grant CREATEDB on the local role or create the DB manually. ' +
          'IAM will fall back to the platform DB until a project database is available.',
      };
    }

    let schemaApplied = false;
    try {
      await this.applyProjectSchema(connectionString);
      schemaApplied = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Project schema push failed for "${databaseName}": ${message}`);
      return {
        ok: false,
        databaseName,
        warning:
          `Database "${databaseName}" was created but schema push failed (${message}). ` +
          `connectionString was saved; re-run project schema push manually.`,
      };
    }

    let seeded = false;
    try {
      const client = await this.projectDb.registerClient(organizationId, connectionString);
      await this.seedProjectDatabase(client, organizationId, owner);
      seeded = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Project DB seed failed for "${databaseName}": ${message}`);
      return {
        ok: true,
        connectionString,
        databaseName,
        schemaApplied,
        seeded: false,
      };
    }

    return {
      ok: true,
      connectionString,
      databaseName,
      schemaApplied,
      seeded,
    };
  }

  private async applyProjectSchema(connectionString: string): Promise<void> {
    const schemaPath = path.join(__dirname, '..', '..', '..', 'prisma', 'schema-project.prisma');
    // When running from dist/, also check nest asset copy under dist/prisma.
    const candidates = [
      schemaPath,
      path.join(__dirname, '..', '..', 'prisma', 'schema-project.prisma'),
      path.join(process.cwd(), 'prisma', 'schema-project.prisma'),
      path.join(process.cwd(), 'dist', 'prisma', 'schema-project.prisma'),
      path.join(process.cwd(), 'apps', 'api', 'prisma', 'schema-project.prisma'),
    ];
    const fs = await import('fs');
    const resolved = candidates.find((p) => fs.existsSync(p));
    if (!resolved) {
      throw new Error(`schema-project.prisma not found (tried: ${candidates.join(', ')})`);
    }

    const prismaCli = path.join(
      process.cwd(),
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );
    const altCli = path.join(
      process.cwd(),
      'apps',
      'api',
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );
    const binCandidates = [
      path.join(process.cwd(), 'node_modules', '.bin', 'prisma'),
      path.join(process.cwd(), 'apps', 'api', 'node_modules', '.bin', 'prisma'),
    ];
    const bin = binCandidates.find((p) => fs.existsSync(p));

    const env = { ...process.env, DATABASE_URL: connectionString };
    if (bin) {
      await execFileAsync(bin, ['db', 'push', '--schema', resolved, '--skip-generate', '--accept-data-loss'], {
        env,
        maxBuffer: 10 * 1024 * 1024,
      });
    } else if (fs.existsSync(prismaCli) || fs.existsSync(altCli)) {
      const cli = fs.existsSync(prismaCli) ? prismaCli : altCli;
      await execFileAsync(
        process.execPath,
        [cli, 'db', 'push', '--schema', resolved, '--skip-generate', '--accept-data-loss'],
        { env, maxBuffer: 10 * 1024 * 1024 },
      );
    } else {
      await execFileAsync(
        'npx',
        ['prisma', 'db', 'push', '--schema', resolved, '--skip-generate', '--accept-data-loss'],
        { env, maxBuffer: 10 * 1024 * 1024 },
      );
    }
    this.logger.log(`Applied project schema via db push (${resolved})`);
  }

  private async seedProjectDatabase(
    client: ProjectPrismaClient,
    organizationId: string,
    owner: {
      id: string;
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<void> {
    await client.user.upsert({
      where: { id: owner.id },
      create: {
        id: owner.id,
        platformUserId: owner.id,
        email: owner.email.toLowerCase(),
        passwordHash: owner.passwordHash,
        firstName: owner.firstName,
        lastName: owner.lastName,
        phone: owner.phone ?? null,
        avatarUrl: owner.avatarUrl ?? null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        organizationId,
        status: 'ACTIVE',
        isActive: true,
      },
      update: {
        platformUserId: owner.id,
        email: owner.email.toLowerCase(),
        firstName: owner.firstName,
        lastName: owner.lastName,
        phone: owner.phone ?? null,
        avatarUrl: owner.avatarUrl ?? null,
        organizationId,
      },
    });

    const member = await client.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId: owner.id },
      },
      create: {
        organizationId,
        userId: owner.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      update: {
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    await this.projectIamSeed.seedOrganization(client, organizationId, member.id);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, description: true, theme: true, logoUrl: true },
    });
    await this.projectIamSeed.ensureLoginPageConfig(client, organizationId, {
      companyName: org?.name ?? '',
      description: org?.description,
      theme: org?.theme ?? 'default',
      logoUrl: org?.logoUrl,
    });
  }
}

export { rewriteDatabaseInUrl } from '../project-db/connection-url';
