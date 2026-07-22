import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { NotificationsGateway } from './notifications.gateway';
import { AuditService } from '../audit/audit.service';

type SendInput = {
  organizationId?: string | null;
  userId: string;
  title: string;
  body: string;
  type?: string;
  link?: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly logger: AppLogger,
    private readonly gateway: NotificationsGateway,
    private readonly audit: AuditService,
  ) {}

  async listInbox(userId: string, organizationId?: string | null) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(organizationId
          ? { OR: [{ organizationId }, { organizationId: null }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { deliveries: true },
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      include: { deliveries: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'All notifications marked read' };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(
    userId: string,
    data: Partial<{
      emailEnabled: boolean;
      pushEnabled: boolean;
      inAppEnabled: boolean;
      mutedTypes: string[];
    }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        emailEnabled: data.emailEnabled,
        pushEnabled: data.pushEnabled,
        inAppEnabled: data.inAppEnabled,
        mutedTypes: data.mutedTypes as Prisma.InputJsonValue | undefined,
      },
      create: {
        userId,
        emailEnabled: data.emailEnabled ?? true,
        pushEnabled: data.pushEnabled ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
        mutedTypes: (data.mutedTypes ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  registerDevice(
    userId: string,
    input: { token: string; platform?: string; label?: string },
  ) {
    return this.prisma.pushDevice.upsert({
      where: { userId_token: { userId, token: input.token } },
      update: {
        platform: input.platform ?? 'web',
        label: input.label,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token: input.token,
        platform: input.platform ?? 'web',
        label: input.label,
      },
    });
  }

  listDevices(userId: string) {
    return this.prisma.pushDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async send(input: SendInput) {
    const prefs = await this.getPreferences(input.userId);
    const muted = Array.isArray(prefs.mutedTypes)
      ? (prefs.mutedTypes as string[])
      : [];
    const type = input.type ?? 'INFO';
    if (muted.includes(type)) {
      return { skipped: true, reason: 'muted' as const };
    }

    const requested = input.channels?.length
      ? input.channels
      : ([
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
          NotificationChannel.PUSH,
        ] as NotificationChannel[]);

    const channels = requested.filter((ch) => {
      if (ch === 'IN_APP') return prefs.inAppEnabled;
      if (ch === 'EMAIL') return prefs.emailEnabled;
      if (ch === 'PUSH') return prefs.pushEnabled;
      return false;
    });

    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId,
        title: input.title,
        body: input.body,
        type,
        link: input.link,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
        deliveries: {
          create: channels.map((channel) => ({
            channel,
            status: NotificationDeliveryStatus.PENDING,
          })),
        },
      },
      include: { deliveries: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });

    for (const delivery of notification.deliveries) {
      try {
        if (delivery.channel === 'IN_APP') {
          this.gateway.emitToUser(input.userId, 'notification', notification);
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } else if (delivery.channel === 'EMAIL' && user?.email) {
          await this.mail.sendMail(
            user.email,
            input.title,
            `<p>${input.body}</p>${input.link ? `<p><a href="${input.link}">Open</a></p>` : ''}`,
          );
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        } else if (delivery.channel === 'PUSH') {
          const devices = await this.listDevices(input.userId);
          this.logger.log(
            `Push queued for ${devices.length} device(s): ${input.title}`,
            'NotificationsService',
          );
          this.gateway.emitToUser(input.userId, 'push', {
            title: input.title,
            body: input.body,
            link: input.link,
            devices: devices.map((d) => d.token),
          });
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: devices.length ? 'SENT' : 'FAILED',
              error: devices.length ? null : 'No push devices registered',
              sentAt: new Date(),
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delivery failed';
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: 'FAILED', error: message },
        });
      }
    }

    const result = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { deliveries: true },
    });

    if (input.organizationId) {
      await this.audit.recordActivity({
        organizationId: input.organizationId,
        userId: input.userId,
        type: 'NOTIFICATION',
        title: input.title,
        summary: input.body,
        link: input.link,
        metadata: { notificationId: result.id, type },
      });
      await this.audit.log({
        organizationId: input.organizationId,
        userId: input.userId,
        action: 'CREATE',
        resource: 'notification',
        resourceId: result.id,
        summary: `Notification: ${input.title}`,
      });
    }

    return result;
  }
}
