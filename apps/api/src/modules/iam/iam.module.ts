import { Module } from '@nestjs/common';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { IamSeedService } from './iam-seed.service';

@Module({
  controllers: [IamController],
  providers: [IamService, IamSeedService],
  exports: [IamService, IamSeedService],
})
export class IamModule {}
