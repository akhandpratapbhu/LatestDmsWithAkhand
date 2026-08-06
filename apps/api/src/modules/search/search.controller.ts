import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard } from '../organizations/org.guard';
import { SearchService } from './search.service';

export class SaveSearchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

export class UpdateSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

@Controller('search')
@UseGuards(OrgGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  global(
    @CurrentOrg() org: OrgContext,
    @Query('q') q = '',
    @Query('scope') scope = 'ALL',
    @Query('limit') limit = '20',
  ) {
    return this.search.universal(org.organizationId, q, scope, Number(limit) || 20);
  }

  @Get('universal')
  universal(
    @CurrentOrg() org: OrgContext,
    @Query('q') q = '',
    @Query('types') types = '',
    @Query('limit') limit = '20',
  ) {
    const typeList = types
      ? types.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;
    return this.search.universal(
      org.organizationId,
      q,
      typeList?.length === 1 ? typeList[0] : 'ALL',
      Number(limit) || 20,
      typeList,
    );
  }

  @Get('saved')
  listSaved(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.search.listSaved(org.organizationId, user.userId);
  }

  @Post('saved')
  save(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: SaveSearchDto,
  ) {
    return this.search.save(org.organizationId, user.userId, dto);
  }

  @Patch('saved/:id')
  updateSaved(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateSearchDto,
  ) {
    return this.search.updateSaved(org.organizationId, user.userId, id, dto);
  }

  @Delete('saved/:id')
  deleteSaved(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.search.deleteSaved(org.organizationId, user.userId, id);
  }
}
