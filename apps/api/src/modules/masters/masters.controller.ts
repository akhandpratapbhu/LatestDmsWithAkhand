import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { CreateMasterDto, UpdateMasterDto } from './dto/masters.dto';
import { MastersService } from './masters.service';

@Controller('masters')
@UseGuards(OrgGuard)
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  /** Unified contacts for chat/calls. MEMBER+ can read. */
  @Get('directory')
  directory(
    @CurrentOrg() org: OrgContext,
    @Query('kinds') kinds?: string,
  ) {
    return this.masters.directory(org.organizationId, kinds);
  }

  @Get(':entity')
  list(@CurrentOrg() org: OrgContext, @Param('entity') entity: string) {
    return this.masters.list(org.organizationId, entity);
  }

  @Get(':entity/:id')
  get(
    @CurrentOrg() org: OrgContext,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.masters.get(org.organizationId, entity, id);
  }

  @Post(':entity')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  create(
    @CurrentOrg() org: OrgContext,
    @Param('entity') entity: string,
    @Body() dto: CreateMasterDto,
  ) {
    return this.masters.create(org.organizationId, entity, dto);
  }

  @Patch(':entity/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  update(
    @CurrentOrg() org: OrgContext,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
  ) {
    return this.masters.update(org.organizationId, entity, id, dto);
  }

  @Delete(':entity/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  remove(
    @CurrentOrg() org: OrgContext,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.masters.remove(org.organizationId, entity, id);
  }
}
