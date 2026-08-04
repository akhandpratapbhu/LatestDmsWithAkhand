import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { FormsService } from './forms.service';
import {
  CreateControlDto,
  CreateFormDto,
  CreateSectionDto,
  CreateTabDto,
  CreateValidationDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/forms.dto';

@Controller('forms')
@UseGuards(OrgGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  list(@CurrentOrg() org: OrgContext) {
    return this.forms.list(org.organizationId);
  }

  @Post()
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateFormDto,
  ) {
    return this.forms.create(org.organizationId, dto, user.userId);
  }

  @Post('sections/:sectionId/controls')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addControl(
    @CurrentOrg() org: OrgContext,
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateControlDto,
  ) {
    return this.forms.addControl(org.organizationId, sectionId, dto);
  }

  @Post('controls/:controlId/validations')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addValidation(
    @CurrentOrg() org: OrgContext,
    @Param('controlId') controlId: string,
    @Body() dto: CreateValidationDto,
  ) {
    return this.forms.addValidation(org.organizationId, controlId, dto);
  }

  @Get(':id')
  get(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.forms.get(org.organizationId, id);
  }

  @Patch(':id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  update(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.forms.update(org.organizationId, id, dto);
  }

  @Post(':id/tabs')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addTab(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: CreateTabDto) {
    return this.forms.addTab(org.organizationId, id, dto);
  }

  @Post(':id/sections')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  addSection(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.forms.addSection(org.organizationId, id, dto);
  }

  @Post(':id/submit')
  submit(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: SubmitFormDto,
  ) {
    return this.forms.submit(org.organizationId, id, user.userId, dto.data);
  }

  @Get(':id/submissions')
  submissions(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.forms.listSubmissions(org.organizationId, id);
  }

  @Get(':id/submissions/:submissionId')
  getSubmission(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.forms.getSubmission(org.organizationId, id, submissionId);
  }

  @Patch(':id/submissions/:submissionId')
  updateSubmission(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmitFormDto,
  ) {
    return this.forms.updateSubmission(org.organizationId, id, submissionId, dto.data);
  }

  @Delete(':id/submissions/:submissionId')
  deleteSubmission(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.forms.deleteSubmission(org.organizationId, id, submissionId);
  }
}
