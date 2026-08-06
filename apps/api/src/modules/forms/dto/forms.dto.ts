import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ControlType,
  FormLayoutType,
  FormStatus,
  ValidationRuleType,
} from '@prisma/client';

export class CreateFormDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FormLayoutType)
  layoutType?: FormLayoutType;

  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;
}

export class UpdateFormDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FormLayoutType)
  layoutType?: FormLayoutType;

  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTabDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateSectionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsOptional()
  @IsString()
  tabId?: string;

  @IsOptional()
  @IsInt()
  columns?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  collapsible?: boolean;
}

export class ValidationDto {
  @IsEnum(ValidationRuleType)
  ruleType!: ValidationRuleType;

  @IsOptional()
  @IsString()
  value?: string;

  @IsString()
  message!: string;
}

export class CreateControlDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/)
  fieldKey!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsEnum(ControlType)
  controlType?: ControlType;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsArray()
  options?: unknown[];

  @IsOptional()
  @IsInt()
  colSpan?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidationDto)
  validations?: ValidationDto[];
}

export class UpdateControlDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsEnum(ControlType)
  controlType?: ControlType;

  @IsOptional()
  @IsString()
  placeholder?: string | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  options?: unknown[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateValidationDto {
  @IsEnum(ValidationRuleType)
  ruleType!: ValidationRuleType;

  @IsOptional()
  @IsString()
  value?: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class SubmitFormDto {
  @IsObject()
  data!: Record<string, unknown>;
}
