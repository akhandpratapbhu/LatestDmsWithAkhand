import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    organizationId?: string | null;
    userId?: string | null;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        summary: input.summary,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  listAudit(organizationId: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Platform admin: audit across all projects (+ platform-only rows with null org). */
  listPlatformAudit(take = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /** Platform admin: activity across all projects. */
  listPlatformTimeline(take = 50) {
    return this.prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /** Platform admin: recent logins for any user (system monitor). */
  listPlatformLogins(take = 100) {
    return this.prisma.loginHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  recordActivity(input: {
    organizationId: string;
    userId?: string | null;
    actorId?: string | null;
    type: string;
    title: string;
    summary?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.activityEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        actorId: input.actorId ?? input.userId ?? null,
        type: input.type,
        title: input.title,
        summary: input.summary,
        link: input.link,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  timeline(organizationId: string, take = 50) {
    return this.prisma.activityEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  userActivity(organizationId: string, userId: string, take = 50) {
    return this.prisma.activityEvent.findMany({
      where: { organizationId, OR: [{ userId }, { actorId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  recordLogin(input: {
    userId: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
    failureReason?: string;
  }) {
    return this.prisma.loginHistory.create({
      data: {
        userId: input.userId,
        success: input.success,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceName: input.deviceName,
        failureReason: input.failureReason,
      },
    });
  }

  loginHistory(userId: string, take = 50) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  adminLoginHistory(organizationId: string, take = 100) {
    return this.prisma.loginHistory.findMany({
      where: {
        user: { memberships: { some: { organizationId } } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}
