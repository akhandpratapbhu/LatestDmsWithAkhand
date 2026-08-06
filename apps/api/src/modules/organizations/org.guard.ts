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

/** Skip X-Organization-Id requirement (e.g. multi-project sidebar listing). */
export const SKIP_ORG_KEY = 'skipOrg';
export const SkipOrg = () => SetMetadata(SKIP_ORG_KEY, true);

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
    const skipOrg = this.reflector.getAllAndOverride<boolean>(SKIP_ORG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipOrg) {
      return true;
    }

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
      (request.query.organizationId as string | undefined) ||
      (typeof request.body === 'object' &&
      request.body &&
      'organizationId' in request.body
        ? (request.body as { organizationId?: string }).organizationId
        : undefined);

    if (!orgId) {
      throw new ForbiddenException('X-Organization-Id header is required');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.userId },
      },
      include: { organization: true },
    });

    if (membership && membership.status === 'ACTIVE' && membership.organization.isActive) {
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

    // Platform admins may open any project without a membership row (they are not
    // the day-to-day project admin — that is the single OWNER created on project create).
    const actor = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { isPlatformAdmin: true },
    });
    if (actor?.isPlatformAdmin) {
      const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
      if (!org?.isActive) {
        throw new ForbiddenException('You are not an active member of this organization');
      }
      const required = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      // Treat platform operator as OWNER for org-scoped platform APIs.
      if (required?.length && !required.includes(OrgRole.OWNER) && !required.includes(OrgRole.ADMIN)) {
        throw new ForbiddenException('Insufficient organization role');
      }
      request.org = {
        organizationId: orgId,
        membershipId: `platform:${user.userId}`,
        role: OrgRole.OWNER,
      };
      return true;
    }

    throw new ForbiddenException('You are not an active member of this organization');
  }
}
