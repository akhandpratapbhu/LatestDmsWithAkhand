import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { NotificationsService } from './notifications.service';
import {
  RegisterPushDeviceDto,
  SendNotificationDto,
  UpdatePreferencesDto,
} from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('unread-count')
  unreadCount(@CurrentUser() user: JwtPayloadUser) {
    return this.notifications.unreadCount(user.userId).then((count) => ({ count }));
  }

  @Get('preferences')
  preferences(@CurrentUser() user: JwtPayloadUser) {
    return this.notifications.getPreferences(user.userId);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdatePreferencesDto) {
    return this.notifications.updatePreferences(user.userId, dto);
  }

  @Get('devices')
  devices(@CurrentUser() user: JwtPayloadUser) {
    return this.notifications.listDevices(user.userId);
  }

  @Post('devices')
  registerDevice(@CurrentUser() user: JwtPayloadUser, @Body() dto: RegisterPushDeviceDto) {
    return this.notifications.registerDevice(user.userId, dto);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayloadUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Get()
  @UseGuards(OrgGuard)
  list(@CurrentUser() user: JwtPayloadUser, @CurrentOrg() org: OrgContext) {
    return this.notifications.listInbox(user.userId, org.organizationId);
  }

  @Post('send')
  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  send(@CurrentOrg() org: OrgContext, @Body() dto: SendNotificationDto) {
    return this.notifications.send({
      organizationId: org.organizationId,
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      link: dto.link,
      data: dto.data,
      channels: dto.channels,
    });
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.notifications.markRead(user.userId, id);
  }
}
