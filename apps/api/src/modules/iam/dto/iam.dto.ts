import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { PermissionType } from '@prisma/client';

export class CreateIamRoleDto {
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
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}

export class UpdateIamRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  menuIds?: string[];
}

export class CreatePermissionDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(PermissionType)
  type!: PermissionType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

export class CreateMenuGroupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateMenuDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  permissionId?: string;

  /** Link menu to a DynamicForm — path becomes /app/data/:formId when set. */
  @IsOptional()
  @IsString()
  formId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  path?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  permissionId?: string | null;

  @IsOptional()
  @IsString()
  formId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignMemberRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
