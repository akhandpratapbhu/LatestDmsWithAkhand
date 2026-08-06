import { Module } from '@nestjs/common';
import { FormsModule } from '../forms/forms.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [FormsModule, OrganizationsModule],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
