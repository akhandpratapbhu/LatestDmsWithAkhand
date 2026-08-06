import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  defaultPlatformEnabledFeatures,
  DEFAULT_PLATFORM_ENABLED_FEATURES,
  getPlatformShellFeatureById,
  isProtectedPlatformFeature,
  PLATFORM_SHELL_FEATURE_CATALOG,
  type PlatformConfigDto,
} from '@dms/shared';
import { PrismaService } from '../../prisma/prisma.service';

const PLATFORM_CONFIG_ID = 'default';

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private parseEnabledFeatures(value: Prisma.JsonValue | null | undefined): string[] {
    if (value == null) return [...DEFAULT_PLATFORM_ENABLED_FEATURES];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string');
        }
      } catch {
        return [...DEFAULT_PLATFORM_ENABLED_FEATURES];
      }
      return [...DEFAULT_PLATFORM_ENABLED_FEATURES];
    }
    if (!Array.isArray(value)) return [...DEFAULT_PLATFORM_ENABLED_FEATURES];
    const list = value.filter((v): v is string => typeof v === 'string');
    return list.length > 0 ? list : [...DEFAULT_PLATFORM_ENABLED_FEATURES];
  }

  private toDto(row: {
    id: string;
    enabledFeatures: Prisma.JsonValue;
    updatedAt: Date;
  }): PlatformConfigDto {
    return {
      id: row.id,
      enabledFeatures: this.parseEnabledFeatures(row.enabledFeatures),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async ensureConfig() {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { id: PLATFORM_CONFIG_ID },
    });
    if (existing) {
      const current = this.parseEnabledFeatures(existing.enabledFeatures);
      // Legacy rows only stored shell menus — expand once to full marketplace defaults.
      const isLegacyShellOnly =
        current.includes('projects') &&
        !current.includes('dashboard') &&
        !current.includes('chat') &&
        !current.includes('grids');
      if (!isLegacyShellOnly) return existing;

      const merged = Array.from(
        new Set([...current, ...defaultPlatformEnabledFeatures()]),
      );
      return this.prisma.platformConfig.update({
        where: { id: PLATFORM_CONFIG_ID },
        data: { enabledFeatures: merged },
      });
    }
    return this.prisma.platformConfig.create({
      data: {
        id: PLATFORM_CONFIG_ID,
        enabledFeatures: defaultPlatformEnabledFeatures(),
      },
    });
  }

  async getConfig(): Promise<PlatformConfigDto> {
    const row = await this.ensureConfig();
    return this.toDto(row);
  }

  listCatalog() {
    return PLATFORM_SHELL_FEATURE_CATALOG;
  }

  private async assertPlatformAdmin(userId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (!actor?.isPlatformAdmin) {
      throw new ForbiddenException('Only a platform admin can change Configure System features');
    }
  }

  async installFeature(userId: string, featureId: string): Promise<PlatformConfigDto> {
    await this.assertPlatformAdmin(userId);
    const feature = getPlatformShellFeatureById(featureId);
    if (!feature) throw new BadRequestException(`Unknown platform feature: ${featureId}`);
    if (feature.comingSoon) {
      throw new BadRequestException(`${feature.name} is coming soon and cannot be installed yet`);
    }

    const row = await this.ensureConfig();
    const current = this.parseEnabledFeatures(row.enabledFeatures);
    if (current.includes(featureId)) return this.toDto(row);

    const enabledFeatures = [...current, featureId];
    const updated = await this.prisma.platformConfig.update({
      where: { id: PLATFORM_CONFIG_ID },
      data: { enabledFeatures },
    });
    return this.toDto(updated);
  }

  async uninstallFeature(userId: string, featureId: string): Promise<PlatformConfigDto> {
    await this.assertPlatformAdmin(userId);
    const feature = getPlatformShellFeatureById(featureId);
    if (!feature) throw new BadRequestException(`Unknown platform feature: ${featureId}`);
    if (isProtectedPlatformFeature(featureId)) {
      throw new ForbiddenException(
        `${feature.name} is a core Configure System feature and cannot be uninstalled`,
      );
    }

    const row = await this.ensureConfig();
    const enabledFeatures = this.parseEnabledFeatures(row.enabledFeatures).filter(
      (id) => id !== featureId,
    );
    const updated = await this.prisma.platformConfig.update({
      where: { id: PLATFORM_CONFIG_ID },
      data: { enabledFeatures },
    });
    return this.toDto(updated);
  }

  async requireFeature(featureId: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabledFeatures.includes(featureId)) {
      throw new NotFoundException(
        `Platform feature "${featureId}" is not enabled on Configure System`,
      );
    }
  }
}
