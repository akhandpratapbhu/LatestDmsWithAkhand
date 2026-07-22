import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgGuard } from './org.guard';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgGuard],
  exports: [OrganizationsService, OrgGuard],
})
export class OrganizationsModule {}
