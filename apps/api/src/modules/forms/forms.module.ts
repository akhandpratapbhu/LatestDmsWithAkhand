import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { AuditModule } from '../audit/audit.module';
import { ProjectDbModule } from '../project-db/project-db.module';

@Module({
  imports: [AuditModule, ProjectDbModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
