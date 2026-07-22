import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayloadUser } from '../auth/decorators/current-user.decorator';

export const ORG_ROLES_KEY = 'orgRoles';
export const RequireOrgRoles = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

export type OrgContext = {
  organizationId: string;
  membershipId: string;
  role: OrgRole;
};

export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): OrgContext => {
  const request = ctx.switchToHttp().getRequest<{ org: OrgContext }>();
  return request.org;
});

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: JwtPayloadUser; org?: OrgContext }
    >();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const orgId =
      (request.headers['x-organization-id'] as string | undefined) ||
      (request.params.organizationId as string | undefined) ||
      (request.query.organizationId as string | undefined);

    if (!orgId) {
      throw new ForbiddenException('X-Organization-Id header is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.userId },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== 'ACTIVE' || !membership.organization.isActive) {
      throw new ForbiddenException('You are not an active member of this organization');
    }

    const required = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required?.length && !required.includes(membership.role)) {
      throw new ForbiddenException('Insufficient organization role');
    }

    request.org = {
      organizationId: orgId,
      membershipId: membership.id,
      role: membership.role,
    };
    return true;
  }
}
