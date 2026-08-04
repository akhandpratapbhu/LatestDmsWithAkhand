import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgGuard } from './org.guard';
import { ProjectDbProvisioner } from './project-db.provisioner';
import { IamModule } from '../iam/iam.module';
import { ProjectDbModule } from '../project-db/project-db.module';

@Module({
  imports: [forwardRef(() => IamModule), ProjectDbModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgGuard, ProjectDbProvisioner],
  exports: [OrganizationsService, OrgGuard, ProjectDbProvisioner],
})
export class OrganizationsModule {}
