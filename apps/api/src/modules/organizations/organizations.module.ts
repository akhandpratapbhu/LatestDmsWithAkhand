import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgGuard } from './org.guard';
import { IamModule } from '../iam/iam.module';

@Module({
  imports: [forwardRef(() => IamModule)],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgGuard],
  exports: [OrganizationsService, OrgGuard],
})
export class OrganizationsModule {}
