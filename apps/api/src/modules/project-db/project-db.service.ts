import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { PrismaService } from '../../prisma/prisma.service';
import { rewriteDatabaseInUrl } from './connection-url';

/**
 * Cached Prisma clients for per-project databases.
 * Resolves connectionString (or builds from databaseName) from platform Organization.
 */
@Injectable()
export class ProjectDbService implements OnModuleDestroy {
  private readonly logger = new Logger(ProjectDbService.name);
  private readonly clients = new Map<string, ProjectPrismaClient>();

  constructor(private readonly platform: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map(async (client) => {
        try {
          await client.$disconnect();
        } catch {
          /* ignore */
        }
      }),
    );
    this.clients.clear();
  }

  /** Returns a project DB client when the org has a provisioned database; otherwise null. */
  async getClient(organizationId: string): Promise<ProjectPrismaClient | null> {
    const cached = this.clients.get(organizationId);
    if (cached) return cached;

    const url = await this.resolveConnectionString(organizationId);
    if (!url) return null;

    const client = new ProjectPrismaClient({
      datasources: { db: { url } },
    });
    try {
      await client.$connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Project DB connect failed for org ${organizationId}: ${message}`);
      try {
        await client.$disconnect();
      } catch {
        /* ignore */
      }
      return null;
    }

    this.clients.set(organizationId, client);
    return client;
  }

  /** Force-create / replace cached client for a known connection string (used after provision). */
  async registerClient(organizationId: string, connectionString: string): Promise<ProjectPrismaClient> {
    const existing = this.clients.get(organizationId);
    if (existing) {
      try {
        await existing.$disconnect();
      } catch {
        /* ignore */
      }
      this.clients.delete(organizationId);
    }
    const client = new ProjectPrismaClient({
      datasources: { db: { url: connectionString } },
    });
    await client.$connect();
    this.clients.set(organizationId, client);
    return client;
  }

  async hasProjectDb(organizationId: string): Promise<boolean> {
    const client = await this.getClient(organizationId);
    return client != null;
  }

  /** Disconnect and remove a cached project DB client (call before DROP DATABASE). */
  async evictClient(organizationId: string): Promise<void> {
    const existing = this.clients.get(organizationId);
    if (!existing) return;
    try {
      await existing.$disconnect();
    } catch {
      /* ignore */
    }
    this.clients.delete(organizationId);
  }

  private async resolveConnectionString(organizationId: string): Promise<string | null> {
    const org = await this.platform.organization.findUnique({
      where: { id: organizationId },
      select: { connectionString: true, databaseName: true },
    });
    if (!org) return null;
    if (org.connectionString?.trim()) return org.connectionString.trim();

    const adminUrl = process.env.DATABASE_URL;
    if (!adminUrl || !org.databaseName) return null;
    return rewriteDatabaseInUrl(adminUrl, org.databaseName);
  }
}
