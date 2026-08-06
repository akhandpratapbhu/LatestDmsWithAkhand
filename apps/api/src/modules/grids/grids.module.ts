import { Module } from '@nestjs/common';
import { GridsController } from './grids.controller';
import { GridsService } from './grids.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [GridsController],
  providers: [GridsService],
  exports: [GridsService],
})
export class GridsModule {}
