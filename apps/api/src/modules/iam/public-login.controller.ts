import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { LoginPageConfigService } from './login-page-config.service';

/** Unauthenticated project login branding. */
@Controller('public')
export class PublicLoginController {
  constructor(private readonly loginPage: LoginPageConfigService) {}

  @Public()
  @Get('projects/:projectKey/login-page')
  getProjectLoginPage(@Param('projectKey') projectKey: string) {
    return this.loginPage.getPublicByProjectKey(projectKey);
  }
}
