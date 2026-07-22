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
} from 'class-validator';
import { GridColumnType } from '@prisma/client';

export class CreateGridDto {
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
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsBoolean()
  enableSort?: boolean;

  @IsOptional()
  @IsBoolean()
  enableFilter?: boolean;

  @IsOptional()
  @IsBoolean()
  enableExport?: boolean;

  @IsOptional()
  @IsBoolean()
  enableImport?: boolean;
}

export class UpdateGridDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsBoolean()
  enableSort?: boolean;

  @IsOptional()
  @IsBoolean()
  enableFilter?: boolean;

  @IsOptional()
  @IsBoolean()
  enableExport?: boolean;

  @IsOptional()
  @IsBoolean()
  enableImport?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateColumnDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/)
  fieldKey!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsEnum(GridColumnType)
  dataType?: GridColumnType;

  @IsOptional()
  @IsBoolean()
  sortable?: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  format?: string;
}

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(GridColumnType)
  dataType?: GridColumnType;

  @IsOptional()
  @IsBoolean()
  sortable?: boolean;

  @IsOptional()
  @IsBoolean()
  filterable?: boolean;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsInt()
  width?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  format?: string | null;
}

export class QueryGridDto {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  pageSize?: number;

  @IsOptional()
  @IsArray()
  filters?: Array<{ field: string; op?: string; value: string | number | boolean }>;

  @IsOptional()
  @IsArray()
  sorts?: Array<{ field: string; dir?: 'asc' | 'desc' }>;
}

export class ImportGridDto {
  @IsArray()
  rows!: Array<Record<string, unknown>>;
}

export class SaveViewDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  filters?: unknown[];

  @IsOptional()
  @IsArray()
  sorts?: unknown[];

  @IsOptional()
  @IsArray()
  columns?: unknown[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
