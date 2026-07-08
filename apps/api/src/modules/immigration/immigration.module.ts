import { Module } from '@nestjs/common';
import { ImmigrationService } from './immigration.service';
import { ImmigrationController } from './immigration.controller';
import { AiAdvisorService } from './ai-advisor.service';
import { AppConfig } from '../../config/app.config';

@Module({
  controllers: [ImmigrationController],
  providers: [ImmigrationService, AiAdvisorService, AppConfig],
  exports: [ImmigrationService], // users + documents modules depend on it
})
export class ImmigrationModule {}
