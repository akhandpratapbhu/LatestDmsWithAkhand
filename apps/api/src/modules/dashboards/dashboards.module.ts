import { Module } from '@nestjs/common';
import { ProjectDbModule } from '../project-db/project-db.module';
import { IamModule } from '../iam/iam.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [IamModule, ProjectDbModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
