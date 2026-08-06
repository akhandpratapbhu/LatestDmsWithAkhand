import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { GridsService } from './grids.service';
import {
  CreateColumnDto,
  CreateGridDto,
  ImportGridDto,
  QueryGridDto,
  SaveViewDto,
  UpdateColumnDto,
  UpdateGridDto,
} from './dto/grids.dto';

@Controller('grids')
@UseGuards(OrgGuard)
export class GridsController {
  constructor(private readonly grids: GridsService) {}

  @Get()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  list(@CurrentOrg() org: OrgContext) {
    return this.grids.list(org.organizationId);
  }

  @Post()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateGridDto,
  ) {
    return this.grids.create(org.organizationId, dto, user.userId);
  }

  @Patch('columns/:columnId')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateColumn(
    @CurrentOrg() org: OrgContext,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.grids.updateColumn(org.organizationId, columnId, dto);
  }

  @Get(':id')
  get(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.grids.get(org.organizationId, id);
  }

  @Patch(':id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  update(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: UpdateGridDto) {
    return this.grids.update(org.organizationId, id, dto);
  }

  @Post(':id/columns')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addColumn(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.grids.addColumn(org.organizationId, id, dto);
  }

  @Post(':id/query')
  query(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: QueryGridDto) {
    return this.grids.query(org.organizationId, id, {
      page: dto.page,
      pageSize: dto.pageSize,
      filters: dto.filters as never,
      sorts: dto.sorts,
    });
  }

  @Post(':id/import')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  importRows(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: ImportGridDto,
  ) {
    return this.grids.importRows(org.organizationId, id, dto.rows);
  }

  @Post(':id/export')
  exportRows(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: QueryGridDto) {
    return this.grids.exportRows(org.organizationId, id, {
      filters: dto.filters as never,
      sorts: dto.sorts,
    });
  }

  @Get(':id/views')
  listViews(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.grids.listViews(org.organizationId, id, user.userId);
  }

  @Post(':id/views')
  saveView(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: SaveViewDto,
  ) {
    return this.grids.saveView(org.organizationId, id, user.userId, dto);
  }
}
