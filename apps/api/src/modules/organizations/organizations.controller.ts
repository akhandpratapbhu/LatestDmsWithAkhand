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
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from './org.guard';
import { OrganizationsService } from './organizations.service';
import {
  CreateBranchDto,
  CreateCostCenterDto,
  CreateDepartmentDto,
  CreateDesignationDto,
  CreateOrganizationDto,
  CreateTeamDto,
  ToggleFeatureDto,
  UpdateBranchDto,
  UpdateCostCenterDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
  UpdateOrganizationDto,
  UpdatePasswordPolicyDto,
  UpdateTeamDto,
} from './dto/org.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayloadUser, @Body() dto: CreateOrganizationDto) {
    return this.orgs.createOrganization(user.userId, dto);
  }

  @Get()
  listMine(@CurrentUser() user: JwtPayloadUser) {
    return this.orgs.listMyOrganizations(user.userId);
  }

  @Get('features/catalog')
  featureCatalog() {
    return this.orgs.listFeatureCatalog();
  }

  @UseGuards(OrgGuard)
  @Get('current')
  getCurrent(@CurrentOrg() org: OrgContext) {
    return this.orgs.getOrganization(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('current')
  updateCurrent(@CurrentOrg() org: OrgContext, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.updateOrganization(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('features/install')
  installFeature(@CurrentOrg() org: OrgContext, @Body() dto: ToggleFeatureDto) {
    return this.orgs.installFeature(org.organizationId, dto.featureId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('features/uninstall')
  uninstallFeature(@CurrentOrg() org: OrgContext, @Body() dto: ToggleFeatureDto) {
    return this.orgs.uninstallFeature(org.organizationId, dto.featureId);
  }

  // Branches — company can have multiple branches
  @UseGuards(OrgGuard)
  @Get('branches')
  listBranches(@CurrentOrg() org: OrgContext) {
    return this.orgs.listBranches(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('branches')
  createBranch(@CurrentOrg() org: OrgContext, @Body() dto: CreateBranchDto) {
    return this.orgs.createBranch(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('branches/:id')
  updateBranch(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.orgs.updateBranch(org.organizationId, id, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('branches/:id')
  async deleteBranch(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.orgs.deleteBranch(org.organizationId, id);
    return { message: 'Branch deleted' };
  }

  // Departments
  @UseGuards(OrgGuard)
  @Get('departments')
  listDepartments(@CurrentOrg() org: OrgContext) {
    return this.orgs.listDepartments(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('departments')
  createDepartment(@CurrentOrg() org: OrgContext, @Body() dto: CreateDepartmentDto) {
    return this.orgs.createDepartment(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('departments/:id')
  updateDepartment(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.orgs.updateDepartment(org.organizationId, id, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('departments/:id')
  async deleteDepartment(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.orgs.deleteDepartment(org.organizationId, id);
    return { message: 'Department deleted' };
  }

  // Designations
  @UseGuards(OrgGuard)
  @Get('designations')
  listDesignations(@CurrentOrg() org: OrgContext) {
    return this.orgs.listDesignations(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('designations')
  createDesignation(@CurrentOrg() org: OrgContext, @Body() dto: CreateDesignationDto) {
    return this.orgs.createDesignation(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('designations/:id')
  updateDesignation(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.orgs.updateDesignation(org.organizationId, id, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('designations/:id')
  async deleteDesignation(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.orgs.deleteDesignation(org.organizationId, id);
    return { message: 'Designation deleted' };
  }

  // Teams
  @UseGuards(OrgGuard)
  @Get('teams')
  listTeams(@CurrentOrg() org: OrgContext) {
    return this.orgs.listTeams(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('teams')
  createTeam(@CurrentOrg() org: OrgContext, @Body() dto: CreateTeamDto) {
    return this.orgs.createTeam(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('teams/:id')
  updateTeam(@CurrentOrg() org: OrgContext, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.orgs.updateTeam(org.organizationId, id, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('teams/:id')
  async deleteTeam(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.orgs.deleteTeam(org.organizationId, id);
    return { message: 'Team deleted' };
  }

  // Cost centers
  @UseGuards(OrgGuard)
  @Get('cost-centers')
  listCostCenters(@CurrentOrg() org: OrgContext) {
    return this.orgs.listCostCenters(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('cost-centers')
  createCostCenter(@CurrentOrg() org: OrgContext, @Body() dto: CreateCostCenterDto) {
    return this.orgs.createCostCenter(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('cost-centers/:id')
  updateCostCenter(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
  ) {
    return this.orgs.updateCostCenter(org.organizationId, id, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('cost-centers/:id')
  async deleteCostCenter(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    await this.orgs.deleteCostCenter(org.organizationId, id);
    return { message: 'Cost center deleted' };
  }

  // Password policy
  @UseGuards(OrgGuard)
  @Get('password-policy')
  getPolicy(@CurrentOrg() org: OrgContext) {
    return this.orgs.getPasswordPolicy(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('password-policy')
  updatePolicy(@CurrentOrg() org: OrgContext, @Body() dto: UpdatePasswordPolicyDto) {
    return this.orgs.updatePasswordPolicy(org.organizationId, dto);
  }
}
