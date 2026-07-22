import { Module } from '@nestjs/common';
import { GridsController } from './grids.controller';
import { GridsService } from './grids.service';

@Module({
  controllers: [GridsController],
  providers: [GridsService],
  exports: [GridsService],
})
export class GridsModule {}
