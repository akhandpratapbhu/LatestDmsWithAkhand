import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session } from '@prisma/client';
import { SessionInfo } from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  toSessionInfo(session: Session, currentSessionId?: string): SessionInfo {
    return {
      id: session.id,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      current: currentSessionId ? session.id === currentSessionId : false,
    };
  }

  async createSession(input: {
    userId: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<Session> {
    const maxDevices = this.config.get<number>('MAX_LOGIN_DEVICES', 5);
    const active = await this.prisma.session.findMany({
      where: { userId: input.userId, revokedAt: null },
      orderBy: { lastActiveAt: 'asc' },
    });

    if (active.length >= maxDevices) {
      const toRevoke = active.slice(0, active.length - maxDevices + 1);
      await this.prisma.$transaction([
        this.prisma.session.updateMany({
          where: { id: { in: toRevoke.map((s) => s.id) } },
          data: { revokedAt: new Date() },
        }),
        this.prisma.refreshToken.updateMany({
          where: { sessionId: { in: toRevoke.map((s) => s.id) }, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
    }

    return this.prisma.session.create({
      data: {
        userId: input.userId,
        deviceName: input.deviceName ?? null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async storeRefreshToken(input: {
    userId: string;
    sessionId: string;
    refreshTokenRaw: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        tokenHash: this.tokens.hashToken(input.refreshTokenRaw),
        expiresAt: input.expiresAt,
      },
    });
  }

  async rotateRefreshToken(refreshTokenRaw: string): Promise<{
    userId: string;
    sessionId: string;
    email: string;
  }> {
    const tokenHash = this.tokens.hashToken(refreshTokenRaw);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true, session: true },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.session.revokedAt || !existing.user.isActive) {
      throw new UnauthorizedException('Session revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return {
      userId: existing.userId,
      sessionId: existing.sessionId,
      email: existing.user.email,
    };
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new ForbiddenException('Session not found');
    }

    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async revokeByRefreshToken(refreshTokenRaw: string): Promise<void> {
    const tokenHash = this.tokens.hashToken(refreshTokenRaw);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) {
      return;
    }
    await this.revokeSession(existing.userId, existing.sessionId);
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
    });

    const ids = sessions.map((s) => s.id);
    if (ids.length === 0) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: { in: ids } },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });
    return sessions.map((s) => this.toSessionInfo(s, currentSessionId));
  }
}
