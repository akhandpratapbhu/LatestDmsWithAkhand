import { Module } from '@nestjs/common';
import { IamController } from './iam.controller';
import { PublicLoginController } from './public-login.controller';
import { IamService } from './iam.service';
import { IamSeedService } from './iam-seed.service';
import { ProjectIamSeedService } from './project-iam-seed.service';
import { LoginPageConfigService } from './login-page-config.service';

@Module({
  controllers: [IamController, PublicLoginController],
  providers: [IamService, IamSeedService, ProjectIamSeedService, LoginPageConfigService],
  exports: [IamService, IamSeedService, ProjectIamSeedService, LoginPageConfigService],
})
export class IamModule {}