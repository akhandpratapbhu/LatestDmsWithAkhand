import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { AppLogger } from '../common/logger/app-logger.service';

@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(
    config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.enabled = config.get<string>('EMAIL_ENABLED', 'false') === 'true';
    this.from = config.get<string>('SMTP_FROM', 'DMS <noreply@dms.local>');

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: config.get<string>('SMTP_HOST', 'localhost'),
        port: config.get<number>('SMTP_PORT', 1025),
        secure: false,
        auth: config.get('SMTP_USER')
          ? {
              user: config.get<string>('SMTP_USER'),
              pass: config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!this.enabled || !this.transporter) {
      this.logger.log(`[mail:dev] to=${to} subject=${subject}\n${html}`, 'MailService');
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, html });
    this.logger.log(`Email sent to ${to}: ${subject}`, 'MailService');
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.sendMail(
      to,
      'Your login OTP',
      `<p>Your one-time password is <strong>${otp}</strong>.</p><p>It expires in a few minutes.</p>`,
    );
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.sendMail(
      to,
      'Reset your password',
      `<p>Click the link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    );
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.sendMail(
      to,
      'Verify your email',
      `<p>Click the link to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    );
  }
}
