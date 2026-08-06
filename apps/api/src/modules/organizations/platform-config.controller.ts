import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser, JwtPayloadUser } from '../auth/decorators/current-user.decorator';
import { PlatformConfigService } from './platform-config.service';

class TogglePlatformFeatureDto {
  @IsString()
  @MinLength(1)
  featureId!: string;
}

@Controller('platform')
export class PlatformConfigController {
  constructor(private readonly platform: PlatformConfigService) {}

  @Get('config')
  getConfig() {
    return this.platform.getConfig();
  }

  @Get('features/catalog')
  catalog() {
    return this.platform.listCatalog();
  }

  @Post('features/install')
  install(@CurrentUser() user: JwtPayloadUser, @Body() dto: TogglePlatformFeatureDto) {
    return this.platform.installFeature(user.userId, dto.featureId);
  }

  @Post('features/uninstall')
  uninstall(@CurrentUser() user: JwtPayloadUser, @Body() dto: TogglePlatformFeatureDto) {
    return this.platform.uninstallFeature(user.userId, dto.featureId);
  }
}
