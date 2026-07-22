import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(OrgGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  logs(@CurrentOrg() org: OrgContext, @Query('limit') limit = '100') {
    return this.audit.listAudit(org.organizationId, Number(limit) || 100);
  }

  @Get('timeline')
  timeline(@CurrentOrg() org: OrgContext, @Query('limit') limit = '50') {
    return this.audit.timeline(org.organizationId, Number(limit) || 50);
  }

  @Get('me')
  myActivity(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Query('limit') limit = '50',
  ) {
    return this.audit.userActivity(org.organizationId, user.userId, Number(limit) || 50);
  }

  @Get('logins')
  myLogins(@CurrentUser() user: JwtPayloadUser, @Query('limit') limit = '50') {
    return this.audit.loginHistory(user.userId, Number(limit) || 50);
  }

  @Get('logins/org')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  orgLogins(@CurrentOrg() org: OrgContext, @Query('limit') limit = '100') {
    return this.audit.adminLoginHistory(org.organizationId, Number(limit) || 100);
  }
}
