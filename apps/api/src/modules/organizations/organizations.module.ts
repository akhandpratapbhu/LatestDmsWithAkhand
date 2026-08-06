import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgGuard } from './org.guard';
import { ProjectDbProvisioner } from './project-db.provisioner';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';
import { IamModule } from '../iam/iam.module';
import { ProjectDbModule } from '../project-db/project-db.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => IamModule), ProjectDbModule, forwardRef(() => UsersModule)],
  controllers: [OrganizationsController, PlatformConfigController],
  providers: [OrganizationsService, OrgGuard, ProjectDbProvisioner, PlatformConfigService],
  exports: [OrganizationsService, OrgGuard, ProjectDbProvisioner, PlatformConfigService],
})
export class OrganizationsModule {}
