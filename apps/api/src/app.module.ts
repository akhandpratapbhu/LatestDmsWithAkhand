import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from './common/logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { ProjectDbModule } from './modules/project-db/project-db.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { IamModule } from './modules/iam/iam.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { FormsModule } from './modules/forms/forms.module';
import { GridsModule } from './modules/grids/grids.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { AuditModule } from './modules/audit/audit.module';
import { MastersModule } from './modules/masters/masters.module';
import { ChatModule } from './modules/chat/chat.module';
import { CallsModule } from './modules/calls/calls.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { SchoolModule } from './modules/school/school.module';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule,
    PrismaModule,
    ProjectDbModule,
    RedisModule,
    MailModule,
    OrganizationsModule,
    UsersModule,
    IamModule,
    DashboardsModule,
    FormsModule,
    GridsModule,
    NotificationsModule,
    SearchModule,
    AuditModule,
    MastersModule,
    ChatModule,
    CallsModule,
    HospitalModule,
    SchoolModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
