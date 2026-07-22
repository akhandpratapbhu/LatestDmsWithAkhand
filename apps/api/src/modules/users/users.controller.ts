import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrgRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg, OrgContext, OrgGuard, RequireOrgRoles } from '../organizations/org.guard';
import { UsersService } from './users.service';
import {
  AcceptInviteDto,
  CreateOrgUserDto,
  InviteUserDto,
  UpdateMemberDto,
  UpdateMemberStatusDto,
  UpdateProfileDto,
} from './dto/users.dto';

const uploadRoot = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(uploadRoot)) {
  mkdirSync(uploadRoot, { recursive: true });
}

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users/me/profile')
  me(@CurrentUser() user: JwtPayloadUser) {
    return this.users.findById(user.userId).then((u) => this.users.toAuthUser(u));
  }

  @Patch('users/me/profile')
  updateProfile(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Post('users/me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadRoot,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Only image uploads are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: JwtPayloadUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.users.setAvatar(user.userId, avatarUrl);
  }

  @Public()
  @Post('users/accept-invite')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.users.acceptInvite(dto);
  }

  @UseGuards(OrgGuard)
  @Get('users')
  list(@CurrentOrg() org: OrgContext) {
    return this.users.listOrgUsers(org.organizationId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('users')
  create(@CurrentOrg() org: OrgContext, @Body() dto: CreateOrgUserDto) {
    return this.users.createOrgUser(org.organizationId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('users/invite')
  invite(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.users.inviteUser(org.organizationId, user.userId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('users/:userId/activate')
  activate(@CurrentOrg() org: OrgContext, @Param('userId') userId: string) {
    return this.users.activateUser(org.organizationId, userId);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('users/:userId')
  updateMember(
    @CurrentOrg() org: OrgContext,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.users.updateMember(org.organizationId, userId, dto);
  }

  @UseGuards(OrgGuard)
  @RequireOrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('users/:userId/status')
  updateStatus(
    @CurrentOrg() org: OrgContext,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    return this.users.updateMemberStatus(org.organizationId, userId, dto.status);
  }
}
