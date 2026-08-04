import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  OrgRole,
  PasswordPolicy,
  User,
  UserAccountStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuthUser, OrgUserDto } from '@dms/shared';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectDbService } from '../project-db/project-db.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly orgs: OrganizationsService,
    private readonly projectDb: ProjectDbService,
  ) {}

  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      isPlatformAdmin: user.isPlatformAdmin,
      organizationId: user.organizationId,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createUser(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    status?: UserAccountStatus;
    phone?: string;
    /** Home/primary org when created in org context. */
    organizationId?: string | null;
  }): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(input.password, rounds);

    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        status: input.status ?? 'ACTIVE',
        isActive: (input.status ?? 'ACTIVE') === 'ACTIVE',
        organizationId: input.organizationId ?? null,
      },
    });
  }

  /** Set home org only when the user does not already have one. */
  private async ensureHomeOrganization(userId: string, organizationId: string): Promise<User> {
    const user = await this.findById(userId);
    if (user.organizationId) {
      return user;
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { organizationId },
    });
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(password, rounds);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  private mapMemberToDto(m: {
    id: string;
    userId: string;
    role: OrgRole | string;
    status: MembershipStatus | string;
    branchId: string | null;
    departmentId: string | null;
    designationId: string | null;
    teamId: string | null;
    costCenterId: string | null;
    joinedAt: Date;
    user: {
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      avatarUrl: string | null;
      organizationId?: string | null;
      status: UserAccountStatus | string;
      emailVerified: boolean;
      emailVerifiedAt: Date | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }): OrgUserDto {
    return {
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      phone: m.user.phone,
      avatarUrl: m.user.avatarUrl,
      organizationId: m.user.organizationId ?? null,
      role: m.role as OrgRole,
      status: m.status as MembershipStatus,
      accountStatus: m.user.status as UserAccountStatus,
      emailVerified: m.user.emailVerified,
      emailVerifiedAt: m.user.emailVerifiedAt?.toISOString() ?? null,
      isActive: m.user.isActive,
      createdAt: m.user.createdAt.toISOString(),
      updatedAt: m.user.updatedAt.toISOString(),
      branchId: m.branchId,
      departmentId: m.departmentId,
      designationId: m.designationId,
      teamId: m.teamId,
      costCenterId: m.costCenterId,
      joinedAt: m.joinedAt.toISOString(),
    };
  }

  /** Mirror a platform user into the project DB (same UUID). */
  private async syncUserToProjectDb(
    client: ProjectPrismaClient,
    organizationId: string,
    user: User,
    membership: {
      role: OrgRole;
      status: MembershipStatus;
      branchId?: string | null;
      departmentId?: string | null;
      designationId?: string | null;
      teamId?: string | null;
      costCenterId?: string | null;
    },
  ): Promise<void> {
    await client.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        platformUserId: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        organizationId: user.organizationId ?? organizationId,
        status: user.status as 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED',
        isActive: user.isActive,
      },
      update: {
        platformUserId: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        organizationId: user.organizationId ?? organizationId,
        status: user.status as 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED',
        isActive: user.isActive,
      },
    });

    await client.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
      create: {
        organizationId,
        userId: user.id,
        role: membership.role,
        status: membership.status,
        branchId: membership.branchId ?? null,
        departmentId: membership.departmentId ?? null,
        designationId: membership.designationId ?? null,
        teamId: membership.teamId ?? null,
        costCenterId: membership.costCenterId ?? null,
      },
      update: {
        role: membership.role,
        status: membership.status,
        branchId: membership.branchId ?? null,
        departmentId: membership.departmentId ?? null,
        designationId: membership.designationId ?? null,
        teamId: membership.teamId ?? null,
        costCenterId: membership.costCenterId ?? null,
      },
    });
  }

  async listOrgUsers(organizationId: string): Promise<OrgUserDto[]> {
    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient) {
      const members = await projectClient.organizationMember.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { joinedAt: 'desc' },
      });
      return members.map((m) => this.mapMemberToDto(m));
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { joinedAt: 'desc' },
    });
    return members.map((m) => this.mapMemberToDto(m));
  }

  async createOrgUser(
    organizationId: string,
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: OrgRole;
      phone?: string;
      branchId?: string;
      departmentId?: string;
      designationId?: string;
      teamId?: string;
      costCenterId?: string;
    },
  ): Promise<OrgUserDto> {
    const policy = await this.orgs.getPasswordPolicy(organizationId);
    this.assertPasswordPolicy(input.password, policy);

    let user = await this.findByEmail(input.email);
    if (user) {
      const existing = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: user.id },
        },
      });
      if (existing) {
        throw new ConflictException('User already belongs to this organization');
      }
      user = await this.ensureHomeOrganization(user.id, organizationId);
    } else {
      user = await this.createUser({
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        status: 'ACTIVE',
        organizationId,
      });
    }

    const role = input.role ?? 'MEMBER';
    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role,
        status: 'ACTIVE',
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        teamId: input.teamId,
        costCenterId: input.costCenterId,
      },
      include: { user: true },
    });

    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient) {
      await this.syncUserToProjectDb(projectClient, organizationId, member.user, {
        role,
        status: 'ACTIVE',
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        teamId: input.teamId,
        costCenterId: input.costCenterId,
      });
    }

    return (await this.listOrgUsers(organizationId)).find((u) => u.userId === user!.id)!;
  }

  async inviteUser(
    organizationId: string,
    invitedById: string,
    input: {
      email: string;
      role?: OrgRole;
      firstName?: string;
      lastName?: string;
      branchId?: string;
      departmentId?: string;
      designationId?: string;
    },
  ): Promise<{ message: string; inviteToken?: string }> {
    const email = input.email.toLowerCase();
    const existingMemberUser = await this.findByEmail(email);
    if (existingMemberUser) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: existingMemberUser.id },
        },
      });
      if (membership) {
        throw new ConflictException('User already in organization');
      }
    }

    const raw = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let userId = existingMemberUser?.id;
    let user = existingMemberUser;
    if (!userId) {
      const tempPassword = randomBytes(16).toString('hex') + 'A1';
      const created = await this.createUser({
        email,
        password: tempPassword,
        firstName: input.firstName ?? 'Invited',
        lastName: input.lastName ?? 'User',
        status: 'INVITED',
        organizationId,
      });
      userId = created.id;
      user = created;
    } else {
      user = await this.ensureHomeOrganization(userId, organizationId);
    }

    await this.prisma.userInvite.create({
      data: {
        organizationId,
        email,
        role: input.role ?? 'MEMBER',
        tokenHash,
        invitedById,
        userId,
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        expiresAt,
      },
    });

    await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: {
        organizationId,
        userId,
        role: input.role ?? 'MEMBER',
        status: 'INVITED',
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
      },
      update: {
        status: 'INVITED',
        role: input.role ?? 'MEMBER',
      },
    });

    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient && user) {
      await this.syncUserToProjectDb(projectClient, organizationId, user, {
        role: input.role ?? 'MEMBER',
        status: 'INVITED',
        branchId: input.branchId,
        departmentId: input.departmentId,
        designationId: input.designationId,
      });
    }

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:5173');
    const inviteUrl = `${appUrl}/accept-invite?token=${raw}`;
    await this.mail.sendMail(
      email,
      'You are invited to DMS',
      `<p>You have been invited to join an organization.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p>`,
    );

    const expose = this.config.get<string>('EMAIL_ENABLED', 'false') !== 'true';
    return {
      message: 'Invitation sent',
      ...(expose ? { inviteToken: raw } : {}),
    };
  }

  async acceptInvite(input: {
    token: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthUser> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const invite = await this.prisma.userInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invite');
    }

    const policy = await this.orgs.getPasswordPolicy(invite.organizationId);
    this.assertPasswordPolicy(input.password, policy);

    const userId = invite.userId;
    if (!userId) {
      throw new BadRequestException('Invite is missing user');
    }

    await this.updatePassword(userId, input.password);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
      },
    });
    const user = await this.ensureHomeOrganization(userId, invite.organizationId);

    await this.prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId: invite.organizationId, userId },
      },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    const projectClient = await this.projectDb.getClient(invite.organizationId);
    if (projectClient) {
      await this.syncUserToProjectDb(projectClient, invite.organizationId, user, {
        role: invite.role,
        status: 'ACTIVE',
        branchId: invite.branchId,
        departmentId: invite.departmentId,
        designationId: invite.designationId,
      });
    }

    return this.toAuthUser(user);
  }

  async activateUser(organizationId: string, userId: string): Promise<OrgUserDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', isActive: true },
    });
    const member = await this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { status: 'ACTIVE' },
    });

    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient) {
      const user = await this.findById(userId);
      await this.syncUserToProjectDb(projectClient, organizationId, user, {
        role: member.role,
        status: 'ACTIVE',
      });
    }

    const list = await this.listOrgUsers(organizationId);
    const row = list.find((u) => u.userId === userId);
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  async updateMemberStatus(
    organizationId: string,
    userId: string,
    status: MembershipStatus,
  ): Promise<OrgUserDto> {
    await this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { status },
    });

    const accountStatus: UserAccountStatus =
      status === 'ACTIVE'
        ? 'ACTIVE'
        : status === 'SUSPENDED'
          ? 'SUSPENDED'
          : status === 'DEACTIVATED'
            ? 'DEACTIVATED'
            : 'INVITED';

    if (status !== 'INVITED') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: accountStatus,
          isActive: status === 'ACTIVE',
        },
      });
    }

    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient) {
      await projectClient.organizationMember.updateMany({
        where: { organizationId, userId },
        data: { status },
      });
      if (status !== 'INVITED') {
        await projectClient.user.updateMany({
          where: { id: userId },
          data: {
            status: accountStatus,
            isActive: status === 'ACTIVE',
          },
        });
      }
    }

    const list = await this.listOrgUsers(organizationId);
    const row = list.find((u) => u.userId === userId);
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  async updateMember(
    organizationId: string,
    userId: string,
    data: Partial<{
      role: OrgRole;
      branchId: string | null;
      departmentId: string | null;
      designationId: string | null;
      teamId: string | null;
      costCenterId: string | null;
      firstName: string;
      lastName: string;
      phone: string | null;
    }>,
  ): Promise<OrgUserDto> {
    const { firstName, lastName, phone, ...memberData } = data;
    if (firstName || lastName || phone !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
      });
    }
    await this.prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: memberData,
    });

    const projectClient = await this.projectDb.getClient(organizationId);
    if (projectClient) {
      if (firstName || lastName || phone !== undefined) {
        await projectClient.user.updateMany({
          where: { id: userId },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(phone !== undefined ? { phone } : {}),
          },
        });
      }
      await projectClient.organizationMember.updateMany({
        where: { organizationId, userId },
        data: memberData,
      });
    }

    const list = await this.listOrgUsers(organizationId);
    const row = list.find((u) => u.userId === userId);
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  async updateProfile(
    userId: string,
    data: Partial<{ firstName: string; lastName: string; phone: string | null }>,
  ): Promise<AuthUser> {
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.toAuthUser(user);
  }

  async setAvatar(userId: string, avatarUrl: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return this.toAuthUser(user);
  }

  assertPasswordPolicy(
    password: string,
    policy: Pick<
      PasswordPolicy,
      | 'minLength'
      | 'requireUppercase'
      | 'requireLowercase'
      | 'requireNumber'
      | 'requireSpecialChar'
    >,
  ): void {
    if (password.length < policy.minLength) {
      throw new BadRequestException(`Password must be at least ${policy.minLength} characters`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must include an uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw new BadRequestException('Password must include a lowercase letter');
    }
    if (policy.requireNumber && !/\d/.test(password)) {
      throw new BadRequestException('Password must include a number');
    }
    if (policy.requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException('Password must include a special character');
    }
  }
}
