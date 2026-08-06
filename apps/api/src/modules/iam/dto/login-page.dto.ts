import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateLoginPageConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeText?: string;

  /** Nullable string: allow clearing with `null` without failing `@IsString()`. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(2000)
  backgroundUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  theme?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(32)
  primaryColor?: string | null;

  @IsOptional()
  @IsBoolean()
  enablePasswordLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  enableOtpLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTwoFactor?: boolean;

  @IsOptional()
  @IsBoolean()
  showRememberMe?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  footerText?: string | null;
}
