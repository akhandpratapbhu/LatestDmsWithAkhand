import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard } from '../organizations/org.guard';
import { BookAppointmentDto } from './dto/hospital.dto';
import { HospitalService } from './hospital.service';

@Controller('hospital')
@UseGuards(OrgGuard)
export class HospitalController {
  constructor(private readonly hospital: HospitalService) {}

  @Get('specialties')
  listSpecialties() {
    return this.hospital.listSpecialties();
  }

  @Get('me')
  me(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.hospital.getMyContext(org.organizationId, user.userId);
  }

  @Get('doctors')
  listDoctors(@CurrentOrg() org: OrgContext, @Query('specialty') specialty?: string) {
    return this.hospital.listDoctors(org.organizationId, specialty);
  }

  @Get('doctors/:doctorId/slots')
  listSlots(@CurrentOrg() org: OrgContext, @Param('doctorId') doctorId: string) {
    return this.hospital.listAvailableSlots(org.organizationId, doctorId);
  }

  @Get('dashboard-stats')
  dashboardStats(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.hospital.getDashboardStats(org.organizationId, user.userId);
  }

  @Get('appointments/mine')
  myAppointments(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.hospital.listMyAppointments(org.organizationId, user.userId);
  }

  @Get('patients/mine')
  myPatients(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.hospital.listMyPatients(org.organizationId, user.userId);
  }

  @Post('appointments')
  book(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: BookAppointmentDto,
  ) {
    return this.hospital.bookAppointment(org.organizationId, user.userId, dto);
  }

  @Post('appointments/:id/cancel')
  cancel(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.hospital.cancelAppointment(org.organizationId, user.userId, id);
  }

  @Post('appointments/:id/complete')
  complete(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
  ) {
    return this.hospital.completeAppointment(org.organizationId, user.userId, id);
  }
}
