import { Global, Module } from '@nestjs/common';
import { ProjectDbService } from './project-db.service';

@Global()
@Module({
  providers: [ProjectDbService],
  exports: [ProjectDbService],
})
export class ProjectDbModule {}
