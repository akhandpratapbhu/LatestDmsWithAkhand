import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';

export type OtpPurpose = 'login' | 'reset';

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private otpKey(email: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${email.toLowerCase()}`;
  }

  private rateKey(email: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:rate:${email.toLowerCase()}`;
  }

  async requestOtp(
    email: string,
    purpose: OtpPurpose = 'login',
  ): Promise<{ message: string }> {
    const rate = await this.redis.get(this.rateKey(email, purpose));
    if (rate) {
      throw new HttpException(
        'Please wait before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const length = this.config.get<number>('OTP_LENGTH', 6);
    const ttl = this.config.get<number>('OTP_EXPIRES_IN_SECONDS', 300);
    const max = 10 ** length;
    const otp = randomInt(0, max).toString().padStart(length, '0');

    await this.redis.set(this.otpKey(email, purpose), otp, ttl);
    await this.redis.set(this.rateKey(email, purpose), '1', 60);

    if (purpose === 'reset') {
      await this.mail.sendPasswordResetOtp(email, otp);
      return { message: 'If that email exists, a password reset OTP was sent' };
    }

    await this.mail.sendOtp(email, otp);
    return { message: 'OTP sent if the account exists' };
  }

  async verifyOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose = 'login',
  ): Promise<void> {
    const stored = await this.redis.get(this.otpKey(email, purpose));
    if (!stored) {
      throw new BadRequestException('OTP expired or not found');
    }
    if (stored !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }
    await this.redis.del(this.otpKey(email, purpose));
  }
}
