import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient as ProjectPrismaClient } from '@dms/project-client';
import { getProjectThemePreset, resolveProjectThemeId, type PublicProjectLoginDto } from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectDbService } from '../project-db/project-db.service';
import { ProjectIamSeedService } from '../iam/project-iam-seed.service';

export type LoginPageConfigDto = {
  id: string;
  organizationId: string;
  companyName: string;
  welcomeText: string;
  description: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  theme: string;
  primaryColor: string | null;
  enablePasswordLogin: boolean;
  enableOtpLogin: boolean;
  enableTwoFactor: boolean;
  showRememberMe: boolean;
  footerText: string | null;
  updatedAt: string;
};

@Injectable()
export class LoginPageConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectDb: ProjectDbService,
    private readonly projectSeed: ProjectIamSeedService,
  ) {}

  private toDto(
    row: Awaited<ReturnType<ProjectPrismaClient['loginPageConfig']['findUniqueOrThrow']>>,
  ): LoginPageConfigDto {
    return {
      id: row.id,
      organizationId: row.organizationId,
      companyName: row.companyName,
      welcomeText: row.welcomeText,
      description: row.description,
      logoUrl: row.logoUrl,
      backgroundUrl: row.backgroundUrl,
      theme: row.theme,
      primaryColor: row.primaryColor,
      enablePasswordLogin: row.enablePasswordLogin,
      enableOtpLogin: row.enableOtpLogin,
      enableTwoFactor: row.enableTwoFactor,
      showRememberMe: row.showRememberMe,
      footerText: row.footerText,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireClient(organizationId: string): Promise<ProjectPrismaClient> {
    const client = await this.projectDb.getClient(organizationId);
    if (!client) {
      throw new NotFoundException(
        'Project database is not available. Create/provision the project DB first to configure the login page.',
      );
    }
    return client;
  }

  /**
   * When login-page description was never set, copy from the project (org) description
   * so settings UI and public login show the text the user already entered elsewhere.
   */
  private async backfillDescriptionFromOrg(
    client: ProjectPrismaClient,
    organizationId: string,
    orgDescription: string | null | undefined,
  ): Promise<Awaited<ReturnType<ProjectPrismaClient['loginPageConfig']['findUniqueOrThrow']>>> {
    let row = await client.loginPageConfig.findUniqueOrThrow({ where: { organizationId } });
    const fromOrg = orgDescription?.trim() || null;
    if (!row.description && fromOrg) {
      row = await client.loginPageConfig.update({
        where: { organizationId },
        data: { description: fromOrg },
      });
    }
    return row;
  }

  async get(organizationId: string): Promise<LoginPageConfigDto> {
    const client = await this.requireClient(organizationId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, description: true },
    });
    await this.projectSeed.ensureLoginPageConfig(client, organizationId, {
      companyName: org?.name,
      description: org?.description,
    });
    const row = await this.backfillDescriptionFromOrg(client, organizationId, org?.description);
    return this.toDto(row);
  }

  /**
   * Resolve project by slug, code, or subdomain and return public login branding.
   * Used by `/:projectSlug/login` (and legacy `/p/:projectSlug/login` redirects).
   */
  async getPublicByProjectKey(projectKey: string): Promise<PublicProjectLoginDto> {
    const key = projectKey.trim().toLowerCase();
    if (!key) {
      throw new NotFoundException('Project not found');
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        isActive: true,
        OR: [{ slug: key }, { code: { equals: key, mode: 'insensitive' } }, { subdomain: key }],
      },
    });
    if (!org) {
      throw new NotFoundException('Project not found');
    }

    const client = await this.projectDb.getClient(org.id);
    if (!client) {
      throw new NotFoundException(
        'Project login page is not available yet. Provision the project database first.',
      );
    }

    await this.projectSeed.ensureLoginPageConfig(client, org.id, {
      companyName: org.name,
      description: org.description,
      theme: org.theme,
      logoUrl: org.logoUrl,
    });
    const row = await this.backfillDescriptionFromOrg(client, org.id, org.description);
    const dto = this.toDto(row);
    const theme = resolveProjectThemeId(
      dto.theme && dto.theme !== 'default' ? dto.theme : org.theme,
    );
    const primaryColor =
      dto.primaryColor?.trim() || getProjectThemePreset(theme).primaryColor;

    return {
      project: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        code: org.code,
        subdomain: org.subdomain,
      },
      config: {
        companyName: dto.companyName || org.name,
        welcomeText: dto.welcomeText,
        description: dto.description ?? org.description,
        logoUrl: dto.logoUrl ?? org.logoUrl,
        backgroundUrl: dto.backgroundUrl,
        theme,
        primaryColor,
        enablePasswordLogin: dto.enablePasswordLogin,
        enableOtpLogin: dto.enableOtpLogin,
        enableTwoFactor: dto.enableTwoFactor,
        showRememberMe: dto.showRememberMe,
        footerText: dto.footerText,
      },
    };
  }

  async update(
    organizationId: string,
    data: Partial<{
      companyName: string;
      welcomeText: string;
      description: string | null;
      logoUrl: string | null;
      backgroundUrl: string | null;
      theme: string;
      primaryColor: string | null;
      enablePasswordLogin: boolean;
      enableOtpLogin: boolean;
      enableTwoFactor: boolean;
      showRememberMe: boolean;
      footerText: string | null;
    }>,
  ): Promise<LoginPageConfigDto> {
    const client = await this.requireClient(organizationId);
    await this.projectSeed.ensureLoginPageConfig(client, organizationId);
    const row = await client.loginPageConfig.update({
      where: { organizationId },
      data: {
        ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
        ...(data.welcomeText !== undefined ? { welcomeText: data.welcomeText } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.backgroundUrl !== undefined ? { backgroundUrl: data.backgroundUrl } : {}),
        ...(data.theme !== undefined ? { theme: data.theme } : {}),
        ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
        ...(data.enablePasswordLogin !== undefined
          ? { enablePasswordLogin: data.enablePasswordLogin }
          : {}),
        ...(data.enableOtpLogin !== undefined ? { enableOtpLogin: data.enableOtpLogin } : {}),
        ...(data.enableTwoFactor !== undefined ? { enableTwoFactor: data.enableTwoFactor } : {}),
        ...(data.showRememberMe !== undefined ? { showRememberMe: data.showRememberMe } : {}),
        ...(data.footerText !== undefined ? { footerText: data.footerText } : {}),
      },
    });
    return this.toDto(row);
  }
}
