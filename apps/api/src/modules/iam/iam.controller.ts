import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrgRole, PermissionType } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import {
  CurrentOrg,
  OrgContext,
  OrgGuard,
  RequireOrgRoles,
  SkipOrg,
} from '../organizations/org.guard';
import { IamService } from './iam.service';
import { LoginPageConfigService } from './login-page-config.service';
import {
  AssignMemberRolesDto,
  CreateIamRoleDto,
  CreateMenuDto,
  CreateMenuGroupDto,
  CreatePermissionDto,
  UpdateIamRoleDto,
  UpdateMenuDto,
  UpdateMenuGroupDto,
} from './dto/iam.dto';
import { UpdateLoginPageConfigDto } from './dto/login-page.dto';

@Controller('iam')
@UseGuards(OrgGuard)
export class IamController {
  constructor(
    private readonly iam: IamService,
    private readonly loginPage: LoginPageConfigService,
  ) {}

  /** Resolve target org from body.organizationId when provided (must match guard org). */
  private menuOrgId(org: OrgContext, bodyOrganizationId?: string): string {
    if (bodyOrganizationId && bodyOrganizationId !== org.organizationId) {
      throw new BadRequestException(
        'organizationId must match the X-Organization-Id header (selected project)',
      );
    }
    return org.organizationId;
  }

  @Get('sidebar')
  sidebar(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.iam.getSidebar(org.organizationId, user.userId);
  }

  /** Menu trees for every project the user belongs to (platform DMS sidebar). */
  @Get('project-sidebars')
  @SkipOrg()
  projectSidebars(@CurrentUser() user: JwtPayloadUser) {
    return this.iam.listProjectSidebars(user.userId);
  }

  @Get('permissions/me')
  myPermissions(@CurrentOrg() org: OrgContext, @CurrentUser() user: JwtPayloadUser) {
    return this.iam.getMemberPermissionCodes(org.organizationId, user.userId);
  }

  @Get('members/:userId/permissions')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  memberPermissions(@CurrentOrg() org: OrgContext, @Param('userId') userId: string) {
    return this.iam.getMemberPermissionsForUser(org.organizationId, userId);
  }

  @Get('roles')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  listRoles(@CurrentOrg() org: OrgContext) {
    return this.iam.listRoles(org.organizationId);
  }

  @Post('roles')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  createRole(@CurrentOrg() org: OrgContext, @Body() dto: CreateIamRoleDto) {
    return this.iam.createRole(org.organizationId, dto);
  }

  @Patch('roles/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateRole(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateIamRoleDto,
  ) {
    return this.iam.updateRole(org.organizationId, id, dto);
  }

  @Get('permissions')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  listPermissions(
    @CurrentOrg() org: OrgContext,
    @Query('type') type?: PermissionType,
  ) {
    return this.iam.listPermissions(org.organizationId, type);
  }

  @Post('permissions')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  createPermission(@CurrentOrg() org: OrgContext, @Body() dto: CreatePermissionDto) {
    return this.iam.createPermission(org.organizationId, dto);
  }

  @Get('menu-groups')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  listMenuGroups(
    @CurrentOrg() org: OrgContext,
    @Query('organizationId') organizationId?: string,
  ) {
    if (organizationId && organizationId !== org.organizationId) {
      throw new BadRequestException(
        'organizationId query must match X-Organization-Id when both are sent',
      );
    }
    return this.iam.listMenuGroups(org.organizationId);
  }

  @Post('menu-groups')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  createMenuGroup(@CurrentOrg() org: OrgContext, @Body() dto: CreateMenuGroupDto) {
    const organizationId = this.menuOrgId(org, dto.organizationId);
    const { organizationId: _ignored, ...data } = dto;
    return this.iam.createMenuGroup(organizationId, data);
  }

  @Patch('menu-groups/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateMenuGroup(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateMenuGroupDto,
  ) {
    const organizationId = this.menuOrgId(org, dto.organizationId);
    const { organizationId: _ignored, ...data } = dto;
    return this.iam.updateMenuGroup(organizationId, id, data);
  }

  @Delete('menu-groups/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  deleteMenuGroup(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.iam.deleteMenuGroup(org.organizationId, id);
  }

  @Post('menus')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  createMenu(@CurrentOrg() org: OrgContext, @Body() dto: CreateMenuDto) {
    const organizationId = this.menuOrgId(org, dto.organizationId);
    const { organizationId: _ignored, ...data } = dto;
    return this.iam.createMenu(organizationId, data);
  }

  @Patch('menus/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateMenu(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ) {
    const organizationId = this.menuOrgId(org, dto.organizationId);
    const { organizationId: _ignored, ...data } = dto;
    return this.iam.updateMenu(organizationId, id, data);
  }

  @Delete('menus/:id')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  deleteMenu(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.iam.deleteMenu(org.organizationId, id);
  }

  @Post('members/:userId/roles')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  assignRoles(
    @CurrentOrg() org: OrgContext,
    @Param('userId') userId: string,
    @Body() dto: AssignMemberRolesDto,
  ) {
    return this.iam.assignMemberRoles(org.organizationId, userId, dto.roleIds);
  }

  @Get('login-page')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  getLoginPage(@CurrentOrg() org: OrgContext) {
    return this.loginPage.get(org.organizationId);
  }

  @Patch('login-page')
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  updateLoginPage(@CurrentOrg() org: OrgContext, @Body() dto: UpdateLoginPageConfigDto) {
    return this.loginPage.update(org.organizationId, dto);
  }
}
