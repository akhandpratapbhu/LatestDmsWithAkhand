import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Flexible create body shared across master entity types. */
export class CreateMasterDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  linkedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Partial update body — all fields optional. */
export class UpdateMasterDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  linkedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
