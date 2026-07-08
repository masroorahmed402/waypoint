import { Module } from '@nestjs/common';
import { CareerService } from './career.service';
import { CareerController } from './career.controller';
import { H1bService } from './h1b.service';
import { AppConfig } from '../../config/app.config';

@Module({
  controllers: [CareerController],
  providers: [CareerService, H1bService, AppConfig],
})
export class CareerModule {}