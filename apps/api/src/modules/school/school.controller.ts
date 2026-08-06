import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext, OrgGuard } from '../organizations/org.guard';
import { SchoolService } from './school.service';

@Controller('school')
@UseGuards(OrgGuard)
export class SchoolController {
  constructor(private readonly school: SchoolService) {}

  @Get('dashboard-stats')
  dashboardStats(@CurrentOrg() org: OrgContext) {
    return this.school.getDashboardStats(org.organizationId);
  }
}
