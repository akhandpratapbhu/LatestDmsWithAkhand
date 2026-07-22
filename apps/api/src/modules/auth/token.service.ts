import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { AuthTokens } from '@dms/shared';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateRawToken(bytes = 48): string {
    return randomBytes(bytes).toString('hex');
  }

  async issueTokens(input: {
    userId: string;
    email: string;
    sessionId: string;
  }): Promise<{ tokens: AuthTokens; refreshTokenRaw: string; refreshExpiresAt: Date }> {
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const accessToken = await this.jwt.signAsync(
      {
        sub: input.userId,
        email: input.email,
        sid: input.sessionId,
        typ: 'access',
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshTokenRaw = this.generateRawToken();
    const refreshExpiresAt = this.parseDurationToDate(refreshExpiresIn);

    return {
      tokens: {
        accessToken,
        refreshToken: refreshTokenRaw,
        expiresIn: accessExpiresIn,
      },
      refreshTokenRaw,
      refreshExpiresAt,
    };
  }

  private parseDurationToDate(duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(Date.now() + value * multipliers[unit]);
  }
}
