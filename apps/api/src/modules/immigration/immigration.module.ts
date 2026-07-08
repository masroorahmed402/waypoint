import { Module } from '@nestjs/common';
import { ImmigrationService } from './immigration.service';
import { ImmigrationController } from './immigration.controller';
import { AiAdvisorService } from './ai-advisor.service';
import { UscisTrackerService } from './uscis-tracker.service';
import { AppConfig } from '../../config/app.config';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ImmigrationController],
  providers: [ImmigrationService, AiAdvisorService, UscisTrackerService, AppConfig],
  exports: [ImmigrationService], // users + documents modules depend on it
})
export class ImmigrationModule {}
