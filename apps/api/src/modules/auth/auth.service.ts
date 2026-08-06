import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ForgotPasswordResetTokenResponse,
  LoginResponse,
  MessageResponse,
  SessionInfo,
} from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../users/users.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { OtpService } from './otp.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyForgotPasswordOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<MessageResponse> {
    const user = await this.users.createUser(dto);
    await this.issueEmailVerification(user.id, user.email);
    return {
      message: 'Registration successful. Please verify your email.',
    };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await this.users.validatePassword(user, dto.password))) {
      if (user) {
        await this.audit.recordLogin({
          userId: user.id,
          success: false,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          deviceName: dto.deviceName,
          failureReason: 'Invalid password',
        });
        await this.audit.log({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'auth',
          summary: 'Login failed',
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        });
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      await this.audit.recordLogin({
        userId: user.id,
        success: false,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        deviceName: dto.deviceName,
        failureReason: 'Account disabled',
      });
      throw new UnauthorizedException('Account is disabled');
    }

    return this.createAuthSession(user.id, user.email, {
      deviceName: dto.deviceName,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
  }

  async loginWithOtp(
    dto: VerifyOtpDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.otp.verifyOtp(dto.email, dto.otp);

    return this.createAuthSession(user.id, user.email, {
      deviceName: dto.deviceName,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
  }

  async requestOtp(email: string): Promise<MessageResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return { message: 'OTP sent if the account exists' };
    }
    try {
      return await this.otp.requestOtp(email);
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw err;
      }
      throw err;
    }
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const rotated = await this.sessions.rotateRefreshToken(refreshToken);
    const user = await this.users.findById(rotated.userId);
    const issued = await this.tokens.issueTokens({
      userId: rotated.userId,
      email: rotated.email,
      sessionId: rotated.sessionId,
    });

    await this.sessions.storeRefreshToken({
      userId: rotated.userId,
      sessionId: rotated.sessionId,
      refreshTokenRaw: issued.refreshTokenRaw,
      expiresAt: issued.refreshExpiresAt,
    });

    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: rotated.sessionId },
    });

    return {
      user: this.users.toAuthUser(user),
      tokens: issued.tokens,
      session: this.sessions.toSessionInfo(session, session.id),
    };
  }

  async logout(input: {
    userId: string;
    sessionId: string;
    refreshToken?: string;
    allDevices?: boolean;
  }): Promise<MessageResponse> {
    if (input.allDevices) {
      await this.sessions.revokeAllSessions(input.userId);
      await this.audit.log({
        userId: input.userId,
        action: 'LOGOUT',
        resource: 'auth',
        summary: 'Logged out from all devices',
      });
      return { message: 'Logged out from all devices' };
    }

    if (input.refreshToken) {
      await this.sessions.revokeByRefreshToken(input.refreshToken);
    } else {
      await this.sessions.revokeSession(input.userId, input.sessionId);
    }
    await this.audit.log({
      userId: input.userId,
      action: 'LOGOUT',
      resource: 'auth',
      summary: 'Logged out',
      metadata: { sessionId: input.sessionId },
    });

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return { message: 'If that email exists, a password reset OTP was sent' };
    }

    try {
      return await this.otp.requestOtp(user.email, 'reset');
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw err;
      }
      throw err;
    }
  }

  async verifyForgotPasswordOtp(
    dto: VerifyForgotPasswordOtpDto,
  ): Promise<ForgotPasswordResetTokenResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.otp.verifyOtp(dto.email, dto.otp, 'reset');

    const raw = this.tokens.generateRawToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashToken(raw),
        expiresAt,
      },
    });

    return {
      message: 'OTP verified. Set your new password.',
      resetToken: raw,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponse> {
    const tokenHash = this.tokens.hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.users.updatePassword(record.userId, dto.password);
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await this.sessions.revokeAllSessions(record.userId);

    return { message: 'Password reset successful. Please log in again.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponse> {
    const tokenHash = this.tokens.hashToken(dto.token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.users.markEmailVerified(record.userId);
    await this.prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string): Promise<MessageResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return { message: 'If that email exists, a verification link was sent' };
    }
    if (user.emailVerified) {
      return { message: 'Email is already verified' };
    }
    await this.issueEmailVerification(user.id, user.email);
    return { message: 'If that email exists, a verification link was sent' };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    return this.users.toAuthUser(user);
  }

  async listSessions(userId: string, sessionId: string): Promise<SessionInfo[]> {
    return this.sessions.listSessions(userId, sessionId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    targetId: string,
  ): Promise<MessageResponse> {
    if (sessionId === targetId) {
      throw new BadRequestException('Cannot revoke the current session this way; use logout');
    }
    await this.sessions.revokeSession(userId, targetId);
    return { message: 'Session revoked' };
  }

  private async createAuthSession(
    userId: string,
    email: string,
    meta: { deviceName?: string; userAgent?: string; ipAddress?: string },
  ): Promise<LoginResponse> {
    const session = await this.sessions.createSession({
      userId,
      deviceName: meta.deviceName,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const issued = await this.tokens.issueTokens({
      userId,
      email,
      sessionId: session.id,
    });

    await this.sessions.storeRefreshToken({
      userId,
      sessionId: session.id,
      refreshTokenRaw: issued.refreshTokenRaw,
      expiresAt: issued.refreshExpiresAt,
    });

    const user = await this.users.findById(userId);

    await this.audit.recordLogin({
      userId,
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceName: meta.deviceName,
    });
    await this.audit.log({
      userId,
      action: 'LOGIN',
      resource: 'auth',
      resourceId: session.id,
      summary: 'User logged in',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      user: this.users.toAuthUser(user),
      tokens: issued.tokens,
      session: this.sessions.toSessionInfo(session, session.id),
    };
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const raw = this.tokens.generateRawToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.tokens.hashToken(raw),
        expiresAt,
      },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const verifyUrl = `${appUrl}/verify-email?token=${raw}`;
    await this.mail.sendEmailVerification(email, verifyUrl);
  }
}
