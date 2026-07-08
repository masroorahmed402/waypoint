import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AppConfig } from '../../config/app.config';
import { EMAIL_SERVICE } from './email.interface';
import { ResendEmailService } from './resend.email';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    AppConfig,
    { provide: EMAIL_SERVICE, useClass: ResendEmailService },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
