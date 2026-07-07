import { Controller, Post, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AppConfig } from '../../config/app.config';

@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService, private config: AppConfig) {}

  /** Dev-only: run the reminder scan immediately instead of waiting for the daily cron. */
  @Post('run')
  async run() {
    if (this.config.isProd) throw new ForbiddenException('Disabled in production');
    const sent = await this.svc.scanAndSend();
    return { ok: true, sent };
  }
}
