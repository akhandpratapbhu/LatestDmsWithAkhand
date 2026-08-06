import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { PrismaService } from '../../prisma/prisma.service';
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

/** Configure System monitoring — no org header required. */
@Controller('platform/audit')
export class PlatformAuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertPlatformAdmin(userId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (!actor?.isPlatformAdmin) {
      throw new ForbiddenException('Only a platform admin can view Configure System audit');
    }
  }

  @Get('logs')
  async logs(@CurrentUser() user: JwtPayloadUser, @Query('limit') limit = '100') {
    await this.assertPlatformAdmin(user.userId);
    return this.audit.listPlatformAudit(Number(limit) || 100);
  }

  @Get('timeline')
  async timeline(@CurrentUser() user: JwtPayloadUser, @Query('limit') limit = '50') {
    await this.assertPlatformAdmin(user.userId);
    return this.audit.listPlatformTimeline(Number(limit) || 50);
  }

  @Get('logins')
  async logins(@CurrentUser() user: JwtPayloadUser, @Query('limit') limit = '100') {
    await this.assertPlatformAdmin(user.userId);
    return this.audit.listPlatformLogins(Number(limit) || 100);
  }
}
