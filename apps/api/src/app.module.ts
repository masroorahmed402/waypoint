import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfig, validateEnv } from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ImmigrationModule } from './modules/immigration/immigration.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CareerModule } from './modules/career/career.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ImmigrationModule,
    DocumentsModule,
    CareerModule,
    HealthModule,
    NotificationsModule,
    MarketingModule,
  ],
  providers: [
    AppConfig,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // global auth; opt out with @Public()
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AppConfig],
})
export class AppModule {}
