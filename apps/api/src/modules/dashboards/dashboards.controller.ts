import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { DashboardsService } from './dashboards.service';
import {
  CreateDashboardDto,
  CreateWidgetDto,
  SetLandingDto,
  UpdateDashboardDto,
  UpdateWidgetDto,
  UpsertRoleDashboardDto,
} from './dto/dashboards.dto';

@Controller('dashboards')
@UseGuards(OrgGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('me')
  mine(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.dashboards.getMine(org.organizationId, user.userId);
  }

  @Get('landings')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  landings(@CurrentOrg() org: OrgContext) {
    return this.dashboards.listLandings(org.organizationId);
  }

  @Post('landings')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  setLanding(@CurrentOrg() org: OrgContext, @Body() dto: SetLandingDto) {
    return this.dashboards.setLanding(org.organizationId, dto);
  }

  @Get()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  list(@CurrentOrg() org: OrgContext) {
    return this.dashboards.list(org.organizationId);
  }

  @Post()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateDashboardDto) {
    return this.dashboards.create(org.organizationId, dto);
  }

  @Put('role')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  upsertForRole(@CurrentOrg() org: OrgContext, @Body() dto: UpsertRoleDashboardDto) {
    return this.dashboards.upsertForRole(org.organizationId, dto);
  }

  @Patch('widgets/:widgetId')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateWidget(
    @CurrentOrg() org: OrgContext,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.dashboards.updateWidget(org.organizationId, widgetId, dto);
  }

  @Delete('widgets/:widgetId')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  deleteWidget(@CurrentOrg() org: OrgContext, @Param('widgetId') widgetId: string) {
    return this.dashboards.deleteWidget(org.organizationId, widgetId);
  }

  @Get(':id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  getOne(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.dashboards.getOne(org.organizationId, id);
  }

  @Patch(':id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  update(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
  ) {
    return this.dashboards.update(org.organizationId, id, dto);
  }

  @Post(':id/widgets')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addWidget(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.dashboards.addWidget(org.organizationId, id, dto);
  }
}
